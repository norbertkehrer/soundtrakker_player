
// ********************************************************************
// * CPC Soundtrakker Jukebox
// ********************************************************************
// * by Norbert Kehrer in 2021 to relax
// ********************************************************************


function strDump(pos, len) {
    let s = "";
    for (let i = pos; i < pos + len; i++) {
        const n = song_data[i];
        s += String.fromCharCode(n);
    };
    return s;
}


function signedByte(n) {
    const b = n & 0xff;
    if (b > 127) {
        return -(256 - b);
    }
    else {
        return b;
    };
}


function loadSong() {
    song = [];
    for (let i = 0; i < song_data.length; i++) {
        if (i > 0x7f) {
            song.push(song_data[i]);
        };
    };
};


function init() {
    delay = song[ADDR_DELAY];
    loop_to = song[ADDR_LOOP_TO];
    pattern_length = song[ADDR_PATTERN_LENGTH];
    song_length = song[ADDR_SONG_LENGTH];

    song_name = strDump(0x80 + ADDR_SONG_NAME, 8);
    instrument_names = [];
    for (let i = 0; i < 16; i++) {
        instrument_names[i] = strDump(0x80 + ADDR_INSTR_NAMES + 8 * i, 8);
    };

    song_delay_counter = delay;
    current_position_in_song_list = 0;
    current_pattern_line = 0;
    for (let ch = 0; ch < 3; ch++) {
        ch_current_instrument[ch] = 0;
        ch_current_instr_position[ch] = 0;
        ch_still_to_go[ch] = 0;
        ch_repeat_length[ch] = 0;
        ch_repeat_position[ch] = 0;
        ch_active_arpeggio[ch] = NO_ARPEGGIO;
        ch_active_arpeggio_number[ch] = 0;
        ch_arpeggio_counter[ch] = 0;
        ch_arpeggio_add_1[ch] = 0;
        ch_arpeggio_add_2[ch] = 0;
        ch_effective_key_number_to_play[ch] = 0;
        ch_tone_period[ch] = 0;
        ch_volume[ch] = 0;
        ch_volume_reduction[ch] = 0;
        ch_hardware_envelope_flag[ch] = HARDW_ENV_OFF;
        ch_hardware_envelope_period[ch] = 0;
        ch_noise_period[ch] = 0;
    };
};


function channelPlayEach50HzStep(ch) {
    if (ch_still_to_go[ch] <= 0) {
        if (ch_repeat_length[ch] === 0) {
            return;
        };
        ch_still_to_go[ch] = ch_repeat_length[ch];
        ch_current_instr_position[ch] = ch_repeat_position[ch];
    };
    const instr_position = ch_current_instr_position[ch];
    ch_current_instr_position[ch]++;
    ch_still_to_go[ch]--;

    // set the tone period based on the key
    ch_tone_period[ch] = key_to_tone_period[ch_effective_key_number_to_play[ch]];

    // Arpeggio 0xx and Fxx
    if (ch_active_arpeggio[ch] !== NO_ARPEGGIO) {
        let delta_to_add_to_key = 0;
        switch (ch_active_arpeggio[ch]) {
            case DIRECT_ARPEGGIO: // not available in Soundtraker 1.x
                switch (ch_arpeggio_counter[ch]) {
                    case 1: delta_to_add_to_key = ch_arpeggio_add_1[ch]; break;
                    case 2: delta_to_add_to_key = ch_arpeggio_add_2[ch]; break;
                    default: delta_to_add_to_key = 0; break;
                };
                ch_arpeggio_counter[ch]++;
                if (ch_arpeggio_counter[ch] >= 3) {
                    ch_arpeggio_counter[ch] = 0;
                };
                break;
            case ARPEGGIO_NUMBER:
                delta_to_add_to_key = signedByte(song[ADDR_ARPEGGI + ch_active_arpeggio_number[ch] * 32 + instr_position]);
                break;
        };
        const new_key = ch_effective_key_number_to_play[ch] + delta_to_add_to_key;
        ch_tone_period[ch] = key_to_tone_period[new_key];
    };

    // Tone envelope
    const tone_add_l = song[ADDR_INSTRUMENTS + ch_current_instrument[ch] * 0x82 + 64 + 2 * instr_position];
    const tone_add_h = song[ADDR_INSTRUMENTS + ch_current_instrument[ch] * 0x82 + 64 + 2 * instr_position + 1];
    let tone_add = ((tone_add_h << 8) | (tone_add_l & 0xff)) & 0xffff;
    if (tone_add > 0x7fff) {
        tone_add = -(0x10000 - tone_add);
    };
    ch_tone_period[ch] += tone_add;

    // Volume Envelope
    let volume_to_set = song[ADDR_INSTRUMENTS + ch_current_instrument[ch] * 0x82 + instr_position];
    if (volume_to_set < 128) {
        volume_to_set &= 0x0f;
        volume_to_set -= ch_volume_reduction[ch];
        if (volume_to_set < 0) {
            volume_to_set = 0;
        };
        ch_volume[ch] = volume_to_set;
    };

    // Noise envelope
    const noise_period = song[ADDR_INSTRUMENTS + ch_current_instrument[ch] * 0x82 + 32 + instr_position];
    if (noise_period < 128) { // >= 128 means: ignore the data from the instrument
        ch_noise_period[ch] = noise_period & 0x1f;
    };
};


function noiseHardwEnvPlayEach50HzStep() {
    // Loop over the channels to clear all noise and hardware envelope
    for (let i = 0; i < 3; i++) {
        const noise_bit = 1 << (3 + i);
        ay_registers[7] |= noise_bit;
        ay_registers[8 + i] &= 0x0f;
    };
    // Loop over the channels to set them, where needed
    for (let i = 0; i < 3; i++) {
        // Noise envelope
        if (ch_noise_period[i] !== 0) {
            const noise_bit = 1 << (3 + i);
            ay_registers[6] = ch_noise_period[i];
            ay_registers[7] &= ((noise_bit ^ 0xff) & 0xff);
        };
        // Hardware envelope
        if (ch_hardware_envelope_flag[i] !== HARDW_ENV_OFF) {
            ay_registers[8 + i] |= 0x10; // mit 8+ 2 geht es - probiere lied led-zep??
            ay_registers[13] = ch_hardware_envelope_flag[i];
            ay_registers[11] = ch_hardware_envelope_period[i];
            ay_registers[12] = 0;
        };
    };

};


function channelPlayEachPatternLine(ch) {
    // Set number of currently playing pattern
    const current_pattern = song[ADDR_SONG_LIST + current_position_in_song_list];

    // get the key in the pattern and process it
    let key_number = 0;
    const my_pattern_address = ADDR_PATTERNS + current_pattern * pattern_length * 9 + current_pattern_line * 9 + ch * 3;
    const key = song[my_pattern_address];
    const key_code = (key >> 4) & 0x0f;
    const octave = (key & 0x0f) - 1;

    if (key === 0xd0) {
        ch_still_to_go[ch] = 0;
        ch_repeat_length[ch] = 0;
    }
    else {
        if ((key !== 0x00) && (octave < 9)) {
            key_number = 12 * octave + key_code - 1;
            ch_current_instr_position[ch] = 0;
            const instr = (song[my_pattern_address + 1] >> 4) & 0x0f;
            ch_current_instrument[ch] = instr;
            ch_repeat_position[ch] = song[ADDR_INSTRUMENTS + instr * 0x82 + 0x80];
            ch_repeat_length[ch] = song[ADDR_INSTRUMENTS + instr * 0x82 + 0x81];
            ch_still_to_go[ch] = 32;
            ch_current_instr_position[ch] = 0;
            ch_volume[ch] = 0;
            ch_volume_reduction[ch] = 0;
        };
    };

    // done, if key is zero
    if (key_number === 0) {
        return;
    };

    const effect = song[my_pattern_address + 1] & 0x0f;
    const par = song[my_pattern_address + 2] & 0xff;

    // set effects
    switch (effect) {
        case 0x1:   // Arpeggio off
            ch_active_arpeggio[ch] = NO_ARPEGGIO;
            ch_hardware_envelope_flag[ch] = HARDW_ENV_OFF;
            break;
        case 0x8:   // Sawtooth
        case 0xc:
        case 0xa:   // Triangle
        case 0xe:
            ch_active_arpeggio[ch] = NO_ARPEGGIO;
            ch_hardware_envelope_flag[ch] = effect;
            ch_hardware_envelope_period[ch] = par;
            break;
        case 0xb:
            ch_volume_reduction[ch] = 15 - (par & 0x0f);
            break;
        case 0xd:
            delay = (par & 0x0f);
            break;
        case 0xf:   // Use arpeggio number
            ch_active_arpeggio[ch] = ARPEGGIO_NUMBER;
            ch_active_arpeggio_number[ch] = par & 0x0f;
            ch_hardware_envelope_flag[ch] = HARDW_ENV_OFF;
            break;

        default:
            break;
    };


    const song_transpose = signedByte(song[ADDR_SONG_TRANSPOSE]);
    const pattern_transpose = signedByte(song[ADDR_PATTERN_TRANSPOSE_TABLE + current_position_in_song_list]);

    key_number += song_transpose + pattern_transpose;

    ch_effective_key_number_to_play[ch] = key_number;

    // set the tone period
    ch_tone_period[ch] = key_to_tone_period[key_number];
}


function interrupt() {
    // After some time, it is enough, so go to the next song
    if ((Date.now() - time_last_song) > DURATION_OF_A_SONG) {
        nextSong();
    };

    // Loop over the 3 channels for the things to do in each interrupt
    for (let i = 0; i < 3; i++) {
        channelPlayEach50HzStep(i);
    };

    // Do the stuff for the noise generator and the hardware envelope in each interrupt
    noiseHardwEnvPlayEach50HzStep();

    // Loop over the 3 channels to set AY registers
    for (let i = 0; i < 3; i++) {
        setVol(i, ch_volume[i]);
        setFrequency(i, ch_tone_period[i]);
    };

    // Update counter for tempo of song
    song_delay_counter--;
    if (song_delay_counter > 0) {
        return;
    };
    song_delay_counter = delay;

    // Loop over the 3 channels for the things to do in each pattern line
    for (let i = 0; i < 3; i++) {
        channelPlayEachPatternLine(i);
    };

    // Update counter for the pattern lines
    current_pattern_line++;
    if (current_pattern_line < pattern_length) {
        return;
    };

    // When pattern is over, reset volume reduction to 0
    ch_volume_reduction[0] = 0;
    ch_volume_reduction[1] = 0;
    ch_volume_reduction[2] = 0;

    // When pattern is over, go to the next position in the song list
    current_pattern_line = 0;
    if (current_position_in_song_list >= song_length) {
        current_position_in_song_list = loop_to;
    }
    else {
        current_position_in_song_list++;
    };

    // Switch off arpeggio and hardware envelopes, when pattern ends
    for (let i = 0; i < 3; i++) {
        ch_active_arpeggio[i] = NO_ARPEGGIO;
        ch_hardware_envelope_flag[i] = HARDW_ENV_OFF;
        //ch_volume[i] = 0;
    };

};


function setFrequency(channel, period) {
    if ((typeof period === "number") && (!isNaN(period)) && (channel < 3)) {
        ay_registers[channel * 2] = period & 0xff;
        ay_registers[channel * 2 + 1] = (period >> 8) & 0x0f;
    };
}


function setVol(channel, vol) {
    if (channel < 3) {
        ay_registers[8 + channel] &= 0xf0;
        ay_registers[8 + channel] |= (vol & 0x0f);
    };
}


function nextSong() {
    selected_song++;
    if (selected_song >= songs.length) {
        selected_song = 0;
    };
    html_selector.selectedIndex = selected_song;
    play();
}


function previousSong() {
    selected_song--;
    if (selected_song < 0) {
        selected_song = songs.length - 1;
    };
    html_selector.selectedIndex = selected_song;
    play();
}


function selectSong(element) {
    selected_song = element.selectedIndex;
    play();
}


// Thank you Bergi and Blorf from stackoverflow for this timing solution:
function calcDrift(arr) {
    // Calculate drift correction.

    /*
    In this example I've used a simple median.
    You can use other methods, but it's important not to use an average. 
    If the user switches tabs and back, an average would put far too much
    weight on the outlier.
    */

    let values = arr.concat(); // copy array so it isn't mutated

    values.sort(function (a, b) {
        return a - b;
    });
    if (values.length === 0) return 0;
    const half = Math.floor(values.length / 2);
    if (values.length % 2) return values[half];
    const median = (values[half - 1] + values[half]) / 2.0;

    return median;
}


function periodicTask() {
    var dt = Date.now() - expected; // the drift (positive for overshooting)
    if (dt > interval) {
        // something really bad happened. Maybe the browser (tab) was inactive?
        // possibly special handling to avoid futile "catch up" run
    };
    // do what is to be done
    interrupt();
    updateUI();

    // don't update the history for exceptionally large values
    if (dt <= interval) {
        // sample drift amount to history after removing current correction
        // (add to remove because the correction is applied by subtraction)
        drift_history.push(dt + drift_correction);

        // predict new drift correction
        drift_correction = calcDrift(drift_history);

        // cap and refresh samples
        if (drift_history.length >= drift_history_samples) {
            drift_history.shift();
        };
    };

    expected += interval;
    // take into account drift with prediction
    setTimeout(periodicTask, Math.max(0, interval - dt - drift_correction));
}


function run() {
    // Make the songs array
    songs = [];
    for (const song in sng_file) {
        songs.push(song);
    };

    // Set first song to play
    selected_song = 104; // Song "Elmibub"

    // UI initialization
    initUi();
}


// The following is for the AY-3-8910 emulator
// The emulator still uses createScriptProcessor, so it will break some time soon :-/
// When I have time, I should convert it to audio worklet to be more future-proof

function updateState(renderer, r) {
    /*    r = [
            0x22, 0x22, // channel A tone period
            0xff, 0x00, // channel B tone period
            0xff, 0x00, // channel C tone period
            0x22, // noise period
            0xf8, // enable
            0x00, // channel A amplitude
            0x00, // channel B amplitude
            0x10, // channel C amplitude
            0x22, 0x00, // envelope period
            0x09,  // envelope shape
            0x00, 0x00
        ];
        */
    renderer.setTone(0, (r[1] << 8) | r[0]);
    renderer.setTone(1, (r[3] << 8) | r[2]);
    renderer.setTone(2, (r[5] << 8) | r[4]);
    renderer.setNoise(r[6]);
    renderer.setMixer(0, r[7] & 1, (r[7] >> 3) & 1, r[8] >> 4);
    renderer.setMixer(1, (r[7] >> 1) & 1, (r[7] >> 4) & 1, r[9] >> 4);
    renderer.setMixer(2, (r[7] >> 2) & 1, (r[7] >> 5) & 1, r[10] >> 4);
    renderer.setVolume(0, r[8] & 0xf);
    renderer.setVolume(1, r[9] & 0xf);
    renderer.setVolume(2, r[10] & 0xf);
    renderer.setEnvelope((r[12] << 8) | r[11]);
    if (r[13] !== ay_reg13_old) {
        ay_reg13_old = r[13];
        if (r[13] != 0xff) {
            renderer.setEnvelopeShape(r[13]);
        };
    };
}


function fillBuffer(e) {
    var left = e.outputBuffer.getChannelData(0);
    var right = e.outputBuffer.getChannelData(1);
    for (var i = 0; i < left.length; i++) {
        isrCounter += isrStep;
        if (isrCounter >= 1) {
            updateState(ayumi, ay_registers);
            isrCounter--;
        }
        ayumi.process();
        ayumi.removeDC();
        left[i] = ayumi.left;
        right[i] = ayumi.right;
        if (master_volume === 0) {
            left[i] = 0;
            right[i] = 0;
        };
    };
}


function play() {
    // The file
    song_data = sng_file[songs[selected_song]];

    //load the song
    loadSong();
    time_last_song = Date.now();

    // Initalize the player
    init();

    if (first_time_start) {
        first_time_start = false;

        // Audio init
        audioContext = new AudioContext();
        audioNode = audioContext.createScriptProcessor(1024, 0, 2);
        audioNode.onaudioprocess = fillBuffer;

        sampleRate = audioContext.sampleRate;
        isrStep = 1;  // I just took 1
        isrCounter = 0;

        ayumi = new Ayumi;
        ayumi.configure(true, 1000000 /* clockrate */, sampleRate);
        ayumi.setPan(0, 0.1, 0);
        ayumi.setPan(1, 0.5, 0);
        ayumi.setPan(2, 0.9, 0);

        audioNode.connect(audioContext.destination);

        // Start the 25Hz interrupt for continuous update.
        expected = Date.now() + interval;
        setTimeout(periodicTask, interval);
    };

};


