
// ********************************************************************
// * CPC Soundtrakker Jukebox
// ********************************************************************
// * by Norbert Kehrer in 2021 to relax
// ********************************************************************


function decimal2digits(n) {
    return ("00" + n).slice(-2);
}


function musicalKey(k) {
    const key_name = [
        "--",
        "C-",
        "C#",
        "D-",
        "D#",
        "E-",
        "F-",
        "F#",
        "G-",
        "G#",
        "A-",
        "A#",
        "B-",
        "--",
        "--",
        "--"
    ];

    const key = key_name[(k >> 4) & 0x0f];
    let octave = "-";
    if ((k & 0x0f) !== 0) {
        octave = ("" + (k & 0x0f)).slice(-1);
    };
    if (key === 0xd0) {
        return "R--";
    }
    else {
        return key + octave;
    };
}


function rect(x, y, w, h, color) {
    for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
            const addr = ((y + j) * (canvas_image.width * 4)) + ((x + i) * 4);
            canvas_image.data[addr + 0] = (color >> 16) & 0xff;
            canvas_image.data[addr + 1] = (color >> 8) & 0xff;
            canvas_image.data[addr + 2] = color & 0xff;;
            canvas_image.data[addr + 3] = 0xff;
        };
    };
}


function drawString(str, x, y, bg_color, fg_color) {
    if (str.length < 1) {
        return;
    };
    for (let c = 0; c < str.length; c++) {
        const char = str.charAt(c);
        let n = char_number[char];
        if (n === undefined) {
            n = 0;
        };
        let image = font[n];
        let pos = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const pixel = image.charAt(pos++);
                const color = (pixel === ".") ? bg_color : fg_color;
                rect(x + j, y + i, 1, 1, color);
            };
        };
        x += 8;
    };
};


function drawTriangleRight(x, y) {
    rect(x, y, 1, 7, COL_BLACK);
    rect(x + 1, y + 1, 1, 5, COL_BLACK);
    rect(x + 2, y + 2, 1, 3, COL_BLACK);
    rect(x + 3, y + 3, 1, 1, COL_BLACK);
}


function drawTriangleLeft(x, y) {
    rect(x + 3, y + 0, 1, 7, COL_BLACK);
    rect(x + 2, y + 1, 1, 5, COL_BLACK);
    rect(x + 1, y + 2, 1, 3, COL_BLACK);
    rect(x + 0, y + 3, 1, 1, COL_BLACK);
}


function drawBox(x, y, w, h) {
    // top and left border
    rect(x, y, w - 1, 1, COL_VIOLET);
    rect(x, y + 1, 1, h - 1, COL_VIOLET);
    // bottom and right border
    rect(x + 1, y + h - 1, w - 1, 1, COL_WHITE);
    rect(x + w - 1, y, 1, h, COL_WHITE);
    // inner block
    rect(x + 1, y + 1, w - 2, h - 2, COL_BLACK);
}


function drawBars() {
    const x = 296;
    const y = 142;
    for (let i = 0; i < 3; i++) {
        const height = ay_registers[8 + i] & 0x0f;
        rect(x + 5 * i, y - 15, 4, 15, COL_BLUE);
        rect(x + 5 * i, y - height, 4, height, COL_BLACK);
    };
    // underline bars
    rect(x, y + 1, 14, 1, COL_BLACK);
}


function drawTracks() {
    // outer box
    rect(0, 0, 320, 200, COL_BLUE);
    rect(0, 0, 320, 1, COL_WHITE);
    rect(0, 0, 1, 200, COL_WHITE);
    rect(0, 199, 320, 1, COL_VIOLET);
    rect(319, 1, 1, 200, COL_VIOLET);

    // tracks etc.
    drawBox(6, 3, 20, 14);  // pattern number
    drawBox(29, 3, 22, 142);  // line numbers
    drawBox(61, 3, 70, 142);  //  track 1
    drawBox(141, 3, 70, 142);  //  track 2
    drawBox(221, 3, 70, 142);  //  track 3

    // track letters
    drawString("a", 52, 2, COL_BLUE, COL_BLACK);
    drawString("&", 52, 10, COL_BLUE, COL_BLACK);
    drawString("b", 132, 2, COL_BLUE, COL_BLACK);
    drawString("&", 132, 10, COL_BLUE, COL_BLACK);
    drawString("c", 212, 2, COL_BLUE, COL_BLACK);
    drawString("&", 212, 10, COL_BLUE, COL_BLACK);

    // copyright message
    drawString("s", 32, 6 + 8 * 2, COL_BLACK, COL_VIOLET);
    drawString("o", 32, 6 + 8 * 3, COL_BLACK, COL_VIOLET);
    drawString("u", 32, 6 + 8 * 4, COL_BLACK, COL_VIOLET);
    drawString("n", 32, 6 + 8 * 5, COL_BLACK, COL_VIOLET);
    drawString("d", 32, 6 + 8 * 6, COL_BLACK, COL_VIOLET);
    drawString("t", 32, 6 + 8 * 7, COL_BLACK, COL_VIOLET);
    drawString("r", 32, 6 + 8 * 8, COL_BLACK, COL_VIOLET);
    drawString("a", 32, 6 + 8 * 9, COL_BLACK, COL_VIOLET);
    drawString("k", 32, 6 + 8 * 10, COL_BLACK, COL_VIOLET);
    drawString("k", 32, 6 + 8 * 11, COL_BLACK, COL_VIOLET);
    drawString("e", 32, 6 + 8 * 12, COL_BLACK, COL_VIOLET);
    drawString("r", 32, 6 + 8 * 13, COL_BLACK, COL_VIOLET);

    drawString("Amstrad", 64, 6 + 8 * 2, COL_BLACK, COL_VIOLET);
    drawString("CPC", 64, 6 + 8 * 3, COL_BLACK, COL_VIOLET);
    drawString("original", 64, 6 + 8 * 4, COL_BLACK, COL_VIOLET);
    drawString("by", 64, 6 + 8 * 6, COL_BLACK, COL_VIOLET);
    drawString("Oliver", 64, 6 + 8 * 8, COL_BLACK, COL_VIOLET);
    drawString("Mayer", 64, 6 + 8 * 9, COL_BLACK, COL_VIOLET);
    drawString("in", 64, 6 + 8 * 11, COL_BLACK, COL_VIOLET);
    drawString("1991", 64, 6 + 8 * 13, COL_BLACK, COL_VIOLET);

    drawString("Java-", 64 + 80, 6 + 8 * 2, COL_BLACK, COL_VIOLET);
    drawString("Script", 64 + 80, 6 + 8 * 3, COL_BLACK, COL_VIOLET);
    drawString("version", 64 + 80, 6 + 8 * 4, COL_BLACK, COL_VIOLET);
    drawString("by", 64 + 80, 6 + 8 * 6, COL_BLACK, COL_VIOLET);
    drawString("Norbert", 64 + 80, 6 + 8 * 8, COL_BLACK, COL_VIOLET);
    drawString("Kehrer", 64 + 80, 6 + 8 * 9, COL_BLACK, COL_VIOLET);
    drawString("in", 64 + 80, 6 + 8 * 11, COL_BLACK, COL_VIOLET);
    drawString("2021", 64 + 80, 6 + 8 * 13, COL_BLACK, COL_VIOLET);

    drawString(" Select ", 64 + 160, 6 + 8 * 5, COL_BLACK, COL_VIOLET);
    drawString("  song  ", 64 + 160, 6 + 8 * 6, COL_BLACK, COL_VIOLET);
    drawString("   or   ", 64 + 160, 6 + 8 * 8, COL_BLACK, COL_VIOLET);
    drawString(" press  ", 64 + 160, 6 + 8 * 10, COL_BLACK, COL_VIOLET);
    drawString(" \"play\"", 64 + 160, 6 + 8 * 11, COL_BLACK, COL_VIOLET);

    drawString("Soundtrakker Module Player", 64, 168, COL_BLUE, COL_BLACK);
    drawString("by Norbert Kehrer in 2021", 64, 180, COL_BLUE, COL_BLACK);


    // triangles to indicate current pattern line
    drawTriangleRight(25, 70);
    drawTriangleRight(57, 70);
    drawTriangleRight(137, 70);
    drawTriangleRight(217, 70);
    drawTriangleLeft(51, 70);
    drawTriangleLeft(131, 70);
    drawTriangleLeft(211, 70);
    drawTriangleLeft(291, 70);

    // The "POS." text left of the triangles
    rect(9 + 0, 71, 1, 5, COL_BLACK); // P
    rect(9 + 1, 71, 1, 1, COL_BLACK);
    rect(9 + 2, 71, 1, 3, COL_BLACK);
    rect(9 + 1, 73, 1, 1, COL_BLACK);
    rect(9 + 4, 71, 1, 5, COL_BLACK); // O
    rect(9 + 5, 71, 1, 1, COL_BLACK);
    rect(9 + 5, 75, 1, 1, COL_BLACK);
    rect(9 + 6, 71, 1, 5, COL_BLACK);
    rect(9 + 8, 71, 3, 1, COL_BLACK); // S
    rect(9 + 8, 71, 1, 3, COL_BLACK);
    rect(9 + 8, 73, 3, 1, COL_BLACK);
    rect(9 + 10, 73, 1, 3, COL_BLACK);
    rect(9 + 8, 75, 2, 1, COL_BLACK);
    rect(9 + 12, 75, 1, 1, COL_BLACK); // .
    rect(9 + 15, 70, 1, 7, COL_BLACK); // | left
    rect(295, 70, 1, 7, COL_BLACK); // | right

    // The ST logo
    rect(292, 12, 2, 1, COL_BLACK);
    rect(295, 12, 1, 1, COL_BLACK);
    rect(297, 12, 1, 1, COL_BLACK);
    rect(299, 12, 3, 1, COL_BLACK);
    rect(302, 10, 1, 2, COL_BLACK);
    rect(300, 9, 2, 1, COL_BLACK);
    rect(299, 7, 1, 2, COL_BLACK);
    rect(300, 6, 9, 1, COL_BLACK);
    rect(306, 6, 1, 7, COL_BLACK);
    rect(310, 6, 2, 1, COL_BLACK);
    rect(313, 6, 5, 1, COL_WHITE);
    rect(315, 5, 1, 3, COL_WHITE);
    rect(315, 3, 1, 1, COL_WHITE);
    rect(315, 9, 1, 1, COL_WHITE);

    // Draw the canvas
    graphicsCtx.putImageData(canvas_image, 0, 0);
}


function muteUnmute() {
    if (master_volume > 0) {
        master_volume = 0;
        html_mute_icon.style.display = "none";
        html_unmute_icon.style.display = "inline";
    }
    else {
        master_volume = 1;
        html_mute_icon.style.display = "inline";
        html_unmute_icon.style.display = "none";
    };
}


function initUi() {
    html_current_pattern_number = document.getElementById("current_pattern_number");
    html_pattern_lines = document.getElementById("pattern_lines");
    for (let i = 0; i < 3; i++) {
        html_tracks[i] = document.getElementById("track" + (i + 1));
        html_instr_names[i] = document.getElementById("instr" + (i + 1));
    };
    for (let i = 0; i < 9; i++) {
        html_bars[i] = document.getElementById("bar" + i);
    };
    html_song_info = document.getElementById("song_info");
    html_selector = document.getElementById("song_selector");
    for (let i = 0; i < songs.length; i++) {
        const song_name = songs[i];
        const option = document.createElement("option");
        option.text = song_name.charAt(0) + (song_name.slice(1)).toLowerCase();
        html_selector.add(option, html_selector[i]);
    };
    html_selector.selectedIndex = selected_song;
    html_mute_icon = document.getElementById("mute_icon");
    html_unmute_icon = document.getElementById("unmute_icon");
    const canvas = document.getElementById("canvas");
    canvas.width = 320;
    canvas.height = 200;
    graphicsCtx = canvas.getContext("2d");
    canvas_image = graphicsCtx.createImageData(canvas.width, canvas.height);
    drawTracks();
}


function clearDisplayList() {
    display_list = [];
    for (let i = 0; i < 2 * DISPLAY_LIST_MIDDLE; i++) {
        display_list.push({
            "pattern_line": 0,
            "notes": [{ "key": 0, "instr_eff": 0 }, { "key": 0, "instr_eff": 0 }, { "key": 0, "instr_eff": 0 }]
        });
    };
    display_list_built_for_song_list_pos = -1;
    display_list_built_for_pattern_line = -1;
}


function drawNoteTracks() {
    let first_line = DISPLAY_LIST_MIDDLE - 8;
    for (let i = 0; i < 3; i++) {
        let line = first_line;
        for (let l = 0; l < 17; l++) {
            const pattern_line = display_list[line].pattern_line;
            const key = display_list[line].notes[i].key;
            const instr_eff = display_list[line].notes[i].instr_eff;
            let pr_line = musicalKey(key) + " " + ("0000" + instr_eff.toString(16).toUpperCase()).slice(-4);
            let pr_pattern_line_nr = decimal2digits(pattern_line);
            if (l === 8) {
                drawString(pr_line, 64 + i * 80, 6 + l * 8, COL_BLACK, COL_WHITE);
                if (i === 0) {
                    drawString(pr_pattern_line_nr, 32, 6 + l * 8, COL_BLACK, COL_WHITE);
                };
            }
            else {
                drawString(pr_line, 64 + i * 80, 6 + l * 8, COL_BLACK, COL_VIOLET);
                if (i === 0) {
                    drawString(pr_pattern_line_nr, 32, 6 + l * 8, COL_BLACK, COL_VIOLET);
                };
            };
            line++;
        };

        // Instrument name
        const name = instrument_names[ch_current_instrument[i]].charAt(0) + (instrument_names[ch_current_instrument[i]].slice(1)).toLowerCase();
        drawString(name, 64 + i * 80, 148, COL_BLUE, COL_BLACK);
    };
}


function setPianoScroll(b) {
    display_piano_scroll = b;
    if (display_piano_scroll) {
        // draw the border of the area at the top and bottom
        rect(31, 3, 256, 1, COL_VIOLET);
        rect(31, 144, 256, 1, COL_WHITE);
    }
    else {
        drawTracks();
    };
};


function drawPianoScroll() {
    // empty the area first
    rect(32, 4, 2 * 128, 140, COL_BLACK);
    rect(32, 4 + 68, 2 * 128, 2, 0x222222);
    // draw area
    let line = DISPLAY_LIST_MIDDLE - 34;
    for (let i = 0; i < 70; i++) {
        const x = 32;
        const y = 2 * i + 4;
        for (let ch = 0; ch < 3; ch++) {
            const key = display_list[line].notes[ch].key;
            const key_nr = ((key >> 4) & 0x0f) + 12 * (key & 0x0f);
            const instr_eff = display_list[line].notes[ch].instr_eff;
            let color = COL_BLACK;
            if (line === DISPLAY_LIST_MIDDLE) {
                color = COL_WHITE;
            }
            else {
                color = instr_color[(instr_eff >> 12) & 0x0f];
            };
            if ((key_nr > 0) && (key_nr < 127)) {
                rect(x + 2 * key_nr, y, 2, 2, color); // draw the dot at the key position
                if (line === DISPLAY_LIST_MIDDLE) {
                    rect(x + 2 * key_nr - 1, y - 1, 4, 4, COL_WHITE);
                };
            };
        };
        line++;
    };
    // Instrument names
    for (let i = 0; i < 3; i++) {
        const name = instrument_names[ch_current_instrument[i]].charAt(0) + (instrument_names[ch_current_instrument[i]].slice(1)).toLowerCase();
        drawString(name, 64 + i * 80, 148, COL_BLUE, COL_BLACK);
    };
}


function updateUI() {
    // leave, if display list has changed and has to be rebuilt
    if ((display_list_built_for_song_list_pos === current_position_in_song_list) &&
        (display_list_built_for_pattern_line === current_pattern_line)) {
        return;
    };

    // else build it:
    display_list_built_for_song_list_pos = current_position_in_song_list;
    display_list_built_for_pattern_line = current_pattern_line;

    // shift the display list one place up
    display_list.shift();
    // build the future starting at the middle
    let songlist_pos = current_position_in_song_list;
    let line = current_pattern_line;
    for (let i = DISPLAY_LIST_MIDDLE; i < 2 * DISPLAY_LIST_MIDDLE; i++) {
        const pattern = song[ADDR_SONG_LIST + songlist_pos];
        let item = [];
        for (let i = 0; i < 3; i++) {
            const my_pattern_address = ADDR_PATTERNS + pattern * pattern_length * 9 + line * 9 + i * 3;
            const key = song[my_pattern_address];
            const instr_eff = ((song[my_pattern_address + 1] << 8) | song[my_pattern_address + 2]) & 0xffff;
            item.push({ "key": key, "instr_eff": instr_eff });
        };
        display_list[i] = { "pattern_line": line, "notes": item };
        line++;
        if (line >= pattern_length) {
            line = 0;
            songlist_pos++;
            if (songlist_pos >= song_length) {
                songlist_pos = loop_to;
            };
        };
    };

    // Draw the pattern number
    drawString(decimal2digits(song[ADDR_SONG_LIST + current_position_in_song_list]), 8, 6, COL_BLACK, COL_WHITE);

    // Draw the frequency spectrum
    drawBars();

    // Draw the notes
    if (display_piano_scroll) {
        drawPianoScroll();
    }
    else {
        drawNoteTracks();
    };

    // Draw the canvas
    graphicsCtx.putImageData(canvas_image, 0, 0);
}


function updateUIold() {
    const pattern = song[ADDR_SONG_LIST + current_position_in_song_list];
    drawString(decimal2digits(pattern), 8, 6, COL_BLACK, COL_WHITE);

    let first_line = current_pattern_line - 8;
    if (first_line < 0) {
        first_line = pattern_length + first_line;
    };
    for (let i = 0; i < 3; i++) {
        let line = first_line;
        for (let l = 0; l < 17; l++) {
            const my_pattern_address = ADDR_PATTERNS + pattern * pattern_length * 9 + line * 9 + i * 3;
            const key = song[my_pattern_address];
            const rest = ((song[my_pattern_address + 1] << 8) | song[my_pattern_address + 2]) & 0xffff;
            let pr_line = musicalKey(key) + " " + ("0000" + rest.toString(16).toUpperCase()).slice(-4);
            let pr_pattern_line_nr = decimal2digits(line);
            if (l === 8) {
                drawString(pr_line, 64 + i * 80, 6 + l * 8, COL_BLACK, COL_WHITE);
                if (i === 0) {
                    drawString(pr_pattern_line_nr, 32, 6 + l * 8, COL_BLACK, COL_WHITE);
                };
            }
            else {
                drawString(pr_line, 64 + i * 80, 6 + l * 8, COL_BLACK, COL_VIOLET);
                if (i === 0) {
                    drawString(pr_pattern_line_nr, 32, 6 + l * 8, COL_BLACK, COL_VIOLET);
                };
            };
            line++;
            if (line >= pattern_length) {
                line = 0;
            };
        };

        // Instrument name
        const name = instrument_names[ch_current_instrument[i]].charAt(0) + (instrument_names[ch_current_instrument[i]].slice(1)).toLowerCase();
        drawString(name, 64 + i * 80, 148, COL_BLUE, COL_BLACK);
    };

    // Draw the frequency spectrum
    drawBars();

    // Draw the canvas
    graphicsCtx.putImageData(canvas_image, 0, 0);
}
