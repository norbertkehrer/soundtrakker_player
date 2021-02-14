
// ********************************************************************
// * CPC Soundtrakker Jukebox
// ********************************************************************
// * by Norbert Kehrer in 2021 to relax
// ********************************************************************


function hex_byte(x) {
    return ("0000" + x.toString(16)).slice(-2);
};


function hex_word(x) {
    return ("0000" + x.toString(16)).slice(-4);
};


function hexDump(pos, len) {
    let s = "";
    for (let i = pos; i < pos + len; i++) {
        if (i < song_data.length) {
            const n = song_data[i];
            s += hex_byte(n) + " ";
        };
    };
    return s;
}


function strDump(pos, len) {
    let s = "";
    for (let i = pos; i < pos + len; i++) {
        const n = song_data[i];
        s += String.fromCharCode(n);
    };
    return s;
}


function hexDumpWord(pos, len) {
    let s = "";
    for (let i = pos; i < pos + 2 * len; i += 2) {
        const l = song_data[i];
        const h = song_data[i + 1];
        const n = (h << 8) | (l & 0xff);
        s += hex_word(n) + " ";
    };
    return s;
}


function getByteArray(pos, len, signed) {
    let a = [];
    for (let i = pos; i < pos + len; i++) {
        let n = song_data[i];
        if (signed === "signed" && (n > 0x7f)) {
            n = -(0x100 - n);
        };
        a.push(n);
    };
    return [pos + len, a];
}


function getWordArray(pos, len, signed) {
    let a = [];
    for (let i = pos; i < pos + 2 * len; i += 2) {
        const l = song_data[i];
        const h = song_data[i + 1];
        let n = (h << 8) | (l & 0xff);
        if (signed === "signed" && (n > 0x7fff)) {
            n = -(0x10000 - n);
        };
        a.push(n);
    };
    return [pos + 2 * len, a];
}


function getString(pos, len) {
    let s = "";
    for (let i = pos; i < pos + len; i++) {
        const n = song_data[i];
        s += String.fromCharCode(n);
    };
    return [pos + len, s];
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


function getNoteNumber(n) {
    const octave = n & 0x0f;
    const note = (n >> 4) & 0x0f;
    const num = octave * 12 + note;
    return num;
}


function getNoteFrequency(n) {
    // C-0 is 16.35 Hz
    // 1.059463094359 is the twelfth root of 2 (2^(1/12))
    // fn = f0 * (a)^n
    const c0_freq = 16.35;
    const two_12_root = 1.059463094359;
    return c0_freq * (two_12_root ** n);
}


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
        ch_hardware_envelope_flag[ch] = 0;
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
    //console.log(ch_current_instr_position[ch] + ", goo=" + ch_still_to_go[ch])
    const instr_position = ch_current_instr_position[ch];
    ch_current_instr_position[ch]++;
    ch_still_to_go[ch]--;

    // set the tone period based on the key
    ch_tone_period[ch] = key_to_tone_period[ch_effective_key_number_to_play[ch]];

    // Arpeggio 0xx and Fxx
    if (ch_active_arpeggio[ch] !== NO_ARPEGGIO) {
        let delta_to_add_to_key = 0;
        switch (ch_active_arpeggio[ch]) {
            case DIRECT_ARPEGGIO:
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
    // Max.Volume Set
    // Volume Slide
    // Hard Envelope
    let vol_change = song[ADDR_INSTRUMENTS + ch_current_instrument[ch] * 0x82 + instr_position];
    if (vol_change < 128) {
        // slide missing here
        vol_change &= 0x0f;
        let volume_to_set = vol_change; // da kommt noch was: - instr_step.volume;
        volume_to_set -= ch_volume_reduction[ch];
        if (volume_to_set < 0) {
            volume_to_set = 0;
        };
        ch_volume[ch] = volume_to_set;
    };

    // Noise envelope
    const noise_period = song[ADDR_INSTRUMENTS + ch_current_instrument[ch] * 0x82 + 32 + instr_position];
    if (noise_period < 128) { // >= 128 means: ignore the data from the instrument
        noise_period[ch] = noise_period & 0x1f;
    };

    //hack:
    if (ch_tone_period_old[ch] !== ch_tone_period[ch])
        setFrequency(ch, ch_tone_period[ch]);

    if (ch_hardware_envelope_flag[ch] === HARDW_ENV_OFF) {
        if (ch_volume_old[ch] !== ch_volume[ch]) {
            setVol(ch, ch_volume[ch]);
        };
    }
    else {
        setVol(ch, 0);
    };

    // remember last volume and tone period
    ch_tone_period_old[ch] = ch_tone_period[ch];
    ch_volume_old[ch] = ch_volume[ch];

    //if ((ch === 0) || (ch === 2)) setVol(ch, 0);


};


function noiseHardwEnvPlayEach50HzStep() {
    // Loop over the channels
    let noise_period = 0;
    let noise_volume = 0;
    let noise_channel = -1;
    let hardware_envelope_vol_sawtooth = 0;
    let hardware_envelope_vol_triangle = 0;
    let hardware_envelope_channel = -1;
    for (let i = 0; i < 3; i++) {
        if (noise_period !== 0) {
            noise_period = ch_noise_period[i];
            noise_volume = ch_volume[i];
            noise_channel = i;
        };
        switch (ch_hardware_envelope_flag[i]) {
            case HARDW_ENV_SAWTOOTH:
                hardware_envelope_period = ch_hardware_envelope_period[i] * 16;
                hardware_envelope_vol_sawtooth = HARDW_ENV_VOLUME;
                hardware_envelope_vol_triangle = 0;
                hardware_envelope_channel = i;
                break;
            case HARDW_ENV_TRIANGLE:
                hardware_envelope_period = ch_hardware_envelope_period[i] * 16 * 2; // Triangle has half the frequency of the sawtooth
                hardware_envelope_vol_sawtooth = 0;
                hardware_envelope_vol_triangle = HARDW_ENV_VOLUME;
                hardware_envelope_channel = i;
                break;
        };
    };

    if (noise_period !== 0) {
        setFrequency(OSCI_NOISE, noise_period);
        setVol(OSCI_NOISE, noise_volume);
        setVol(noise_channel, 0);
    }
    else {
        setVol(OSCI_NOISE, 0);
    };

    if ((hardware_envelope_vol_sawtooth > 0) || (hardware_envelope_vol_triangle > 0)) {
        setVol(OSCI_SAWTOOTH, hardware_envelope_vol_sawtooth);
        setVol(OSCI_TRIANGLE, hardware_envelope_vol_triangle);
        setVol(hardware_envelope_channel, 0);
        setFrequency(OSCI_SAWTOOTH, hardware_envelope_period);
        setFrequency(OSCI_TRIANGLE, hardware_envelope_period);
    }
    else {
        setVol(OSCI_SAWTOOTH, 0);
        setVol(OSCI_TRIANGLE, 0);
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

    const effect = song[my_pattern_address + 1] & 0x0f;
    const par = song[my_pattern_address + 2] & 0xff;


    // do effects here
    switch (effect) {
        case 0x1:   // Arpeggio off
            ch_active_arpeggio[ch] = NO_ARPEGGIO;
            ch_hardware_envelope_flag[ch] = HARDW_ENV_OFF;
            break;
        case 0x8:   // Sawtooth
        case 0xc:
            ch_active_arpeggio[ch] = NO_ARPEGGIO;
            ch_hardware_envelope_flag[ch] = HARDW_ENV_SAWTOOTH;
            ch_hardware_envelope_period[ch] = par;
            break;
        case 0xa:   // Triangle
        case 0xe:
            ch_active_arpeggio[ch] = NO_ARPEGGIO;
            ch_hardware_envelope_flag[ch] = HARDW_ENV_TRIANGLE;
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

    // done, if key is zero
    if (key_number === 0) {
        return;
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

    // Schedule the next interrupt (50 Hz)
    if (exact_timing) {
        requestAnimationFrame(interrupt);
        // This is for timing to make the 60 Hz frame refresh to a 50 Hz interrupt like in old European TV sets
        timing_counter++;
        if (timing_counter > 4) {
            timing_counter = 0;
            return;
        };
    }
    else {  // Not exact due to the weakness of Firefox, but can be run, when browser window is not visible
        const now = Date.now();
        time_last_interrupt = now;
        timeout = setTimeout(interrupt, 20);
    };

    // Loop over the 3 channels for the things to do in each interrupt
    for (let i = 0; i < 3; i++) {
        channelPlayEach50HzStep(i);
    };

    // Do the stuff for the noise generator and the hardware envelope in each interrupt
    noiseHardwEnvPlayEach50HzStep();

    // Update counter for tempo of song
    song_delay_counter--;
    if (song_delay_counter > 0) {
        return;
    };
    song_delay_counter = delay;

    // Loop over the 3 channels for the things to do in each pattern line
    for (let i = 0; i < 3; i++) {
        channelPlayEachPatternLine(i)
    };

    updateUI();

    // Update counter for the pattern lines
    current_pattern_line++;
    //console.log(current_position_in_song_list + ":" + song[ADDR_SONG_LIST + current_position_in_song_list] + "/" + current_pattern_line)
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
    };

};







function setFrequency(channel, period) {
    if ((typeof period !== "number") || (period === 0) || (isNaN(period))) {
        return;
    };
    if (channel === OSCI_NOISE) {
        const detune_value = 1000000 / period / 16 * 2;
        osci[channel].detune.value = 1000 + detune_value;  // Hack - check this!!!!
    }
    else {
        const freq = 1000000 / period / 16;
        osci[channel].frequency.setValueAtTime(freq, audioCtx.currentTime); // value in Hertz
    };
}


function setVol(channel, vol) {
    const volume = volume_to_percent[vol] * master_volume;
    osci_volume[channel] = vol; // just needed for visualization
    gain[channel].gain.setValueAtTime(volume, audioCtx.currentTime); // value in percent (between 0.00 and 1.00)
}


function initOsci(channel) {
    switch (channel) {
        case 0:
        case 1:
        case 2:
            gain[channel] = audioCtx.createGain();
            osci[channel] = audioCtx.createOscillator();
            osci[channel].type = "square";
            setFrequency(channel, 197);
            osci[channel].connect(gain[channel]);
            gain[channel].connect(filter);
            osci[channel].start();
            setVol(channel, 0);
            break;
        case OSCI_NOISE:
            const bufferSize = 2 * audioCtx.sampleRate;
            const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            let output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            };
            gain[channel] = audioCtx.createGain();
            osci[channel] = audioCtx.createBufferSource();
            osci[channel].buffer = noiseBuffer;
            osci[channel].loop = true;
            setFrequency(channel, 0);
            osci[channel].connect(gain[channel]);
            gain[channel].connect(filter);
            osci[channel].start();
            setVol(channel, 0);
            break;
        case OSCI_SAWTOOTH:
            gain[channel] = audioCtx.createGain();
            osci[channel] = audioCtx.createOscillator();
            osci[channel].type = "sawtooth";
            setFrequency(channel, 0);
            osci[channel].connect(gain[channel]);
            gain[channel].connect(filter);
            osci[channel].start();
            setVol(channel, 0);
            break;
        case OSCI_TRIANGLE:
            gain[channel] = audioCtx.createGain();
            osci[channel] = audioCtx.createOscillator();
            osci[channel].type = "triangle";
            setFrequency(channel, 0);
            osci[channel].connect(gain[channel]);
            gain[channel].connect(filter);
            osci[channel].start();
            setVol(channel, 0);
            break;
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


function play() {
    // Mute the oscillators at the beginning
    if (!first_time_start) {
        setVol(0, 0);
        setVol(1, 0);
        setVol(2, 0);
        setVol(OSCI_NOISE, 0);
        setVol(OSCI_SAWTOOTH, 0);
        setVol(OSCI_TRIANGLE, 0);
    };

    // The file
    song_data = sng_file[songs[selected_song]];

    //load the song
    loadSong();
    time_last_song = Date.now();

    // Initalize the player
    init();

    if (first_time_start) {
        first_time_start = false;

        // Create filter node
        filter = audioCtx.createBiquadFilter();
        filter.frequency.value = 5000;
        filter.detune.value = 100;
        filter.gain.value = 25;
        filter.connect(audioCtx.destination);

        // Create Oscillator nodes
        initOsci(0);
        initOsci(1);
        initOsci(2);
        initOsci(OSCI_NOISE);
        initOsci(OSCI_SAWTOOTH);
        initOsci(OSCI_TRIANGLE);

        // switch timing method (from requestAnimationFrame to setTimeout), when the user switches away from this window
        document.addEventListener("visibilitychange", () => {
            exact_timing = (document.visibilityState === "visible");
            if (!exact_timing) {
                time_last_interrupt = Date.now();
                timeout = setTimeout(interrupt, 20);
            }
            else {
                clearTimeout(timeout);
            };
        });

        // Start the 50Hz interrupt for continuous update. These damned browsers still have differences in timing!! That's crazy. Come on guys we are in 2021.
        time_last_interrupt = Date.now();
        requestAnimationFrame(interrupt);
    };
}


function run() {
    // Make the songs array
    songs = [];
    for (const song in sng_file) {
        songs.push(song);
    };

    // Set first song to play
    selected_song = 72; // Song "Demo1"

    // UI initialization
    initUi();
}


