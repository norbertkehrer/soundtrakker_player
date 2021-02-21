
// ********************************************************************
// * CPC Soundtrakker Jukebox
// ********************************************************************
// * by Norbert Kehrer in 2021 to relax
// ********************************************************************


// All the song data
// let sng_file = {};  // only needed for individual song file includes

// For the parser box in debugging
let div_parser = {};
let parsed_text = "";

// Current song data
let song = [];

// Create web audio api context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// To translate musical keys to period length values
const key_to_tone_period = [
  3822, 3608, 3405, 3214, 3034, 2863,
  2703, 2551, 2408, 2273, 2145, 2025,
  1911, 1804, 1703, 1607, 1517, 1432,
  1351, 1276, 1204, 1136, 1073, 1012,
  956, 902, 851, 804, 758, 716,
  676, 638, 602, 568, 536, 506,
  478, 451, 426, 402, 379, 358,
  338, 319, 301, 284, 268, 253,
  239, 225, 213, 201, 190, 179,
  169, 159, 150, 142, 134, 127,
  119, 113, 106, 100, 95, 89,
  84, 80, 75, 71, 67, 63,
  60, 56, 53, 50, 47, 45,
  42, 40, 38, 36, 34, 32,
  30, 28, 27, 25, 24, 22,
  21, 20, 19, 18, 17, 16,
  15, 0, 0
];

// Addresses for the song data
const ADDR_INSTRUMENTS = 0x000;
const ADDR_ARPEGGI = 0x820;
const ADDR_SONG_LIST = 0xa30;
const ADDR_SONG_NAME = 0xa90;
const ADDR_INSTR_NAMES = 0xa98;
const ADDR_PATTERN_TRANSPOSE_TABLE = 0xb18;
const ADDR_DELAY = 0xb7b;
const ADDR_LOOP_TO = 0xb7c;
const ADDR_PATTERN_LENGTH = 0xb7d;
const ADDR_SONG_TRANSPOSE = 0xb7e;
const ADDR_SONG_LENGTH = 0xb7f;
const ADDR_PATTERNS = 0xb80;

// Hardware envelopes
const HARDW_ENV_OFF = 0;
const HARDW_ENV_SAWTOOTH = 1;
const HARDW_ENV_TRIANGLE = 2;
const HARDW_ENV_VOLUME = 10;

// Arpeggio states
const NO_ARPEGGIO = 0;
const ARPEGGIO_NUMBER = 1;
const DIRECT_ARPEGGIO = 2;

// Song registers
let delay = 0;
let loop_to = 0;
let pattern_length = 0;
let song_length = 0;
let current_position_in_song_list = 0;
let current_pattern_line = 0;
let song_delay_counter = 0;

// Channel registers
let ch_current_instrument = [];
let ch_current_instr_position = [];
let ch_still_to_go = [];
let ch_repeat_length = [];
let ch_repeat_position = [];
let ch_active_arpeggio = [];
let ch_active_arpeggio_number = [];
let ch_arpeggio_counter = [];
let ch_arpeggio_add_1 = [];
let ch_arpeggio_add_2 = [];
let ch_effective_key_number_to_play = [];
let ch_tone_period = [];
let ch_volume = [];
let ch_volume_reduction = [];
let ch_hardware_envelope_flag = [];
let ch_hardware_envelope_period = [];
let ch_noise_period = [];

// The registers of the AY-3-8910
let ay_registers = [
  0x22, 0x22, // channel A tone period
  0x22, 0x22, // channel B tone period
  0x22, 0x22, // channel C tone period
  0x22, // noise period
  0xf8, // enable
  0x00, // channel A amplitude
  0x00, // channel B amplitude
  0x00, // channel C amplitude
  0x22, 0x22, // envelope period
  0x00,  // envelope shape
  0x00, 0x00
];

let ay_reg13_old = -1;

// For muting:
let master_volume = 1;
let channel_muted = [false, false, false];

// Textual information in the song data
let song_name = "";
let instrument_names = [];

// Array of available song names and the currently selected song
let songs = [];
let selected_song = 0;

// True, when first song is started, false later
let first_time_start = true;

// This is for timing. I do not understand, why Firefox cannot do a reliable setInterval(20). Works in Chrome.
const interval = 20; // ms
let expected = Date.now() + interval;
let drift_history = [];
let drift_history_samples = 10;
let drift_correction = 0;

//let exact_timing = true;
let time_last_interrupt = 0;
let time_last_song = 0;
const DURATION_OF_A_SONG = 180 * 1000; // in milliseconds

// HTML elements for the UI
let html_current_pattern_number = {};
let html_pattern_lines = {};
let html_tracks = [];
let html_instr_names = [];
let html_bars = [];
let html_song_info = {};
let html_selector = {};
let html_mute_icon = {};
let html_unmute_icon = {};

// Display list for the track windows in the UI
const DISPLAY_LIST_MIDDLE = 200;
let display_list = [];
let display_list_built_for_song_list_pos = 0;
let display_list_built_for_pattern_line = 0;
let display_piano_scroll = false;
const instr_color = [
  0xff8000,   // orange
  0xff0000,   // red
  0x8080FF,   // light blue
  0x00ffff,   // turquoise
  0xff00ff,   // magenta
  0xffff00,   // yellow
  0xff0000,   // red
  0x0000ff,   // blue
  0xff007f,   // pink
  0x7f00ff,   // violet
  0x00ff80,   // light green
  0xff00ff,   // magenta
  0xffff00,   // yellow
  0xff8000,   // orange
  0xff0000,   // red
  0x0000ff,   // blue
  0x8080FF    // light blue
];

// Canvas context for the track visualization
let graphicsCtx = {};
let canvas_image = [];

// Colors
const COL_BLACK = 0x000000;
const COL_WHITE = 0xffffff;
const COL_BLUE = 0x8080FF;
const COL_VIOLET = 0x8000FF;

// Font characters
const char_number = {
  " ": 0x00,
  "!": 0x01,
  "\"": 0x02,
  "#": 0x03,
  //"": 0x04,
  //"": 0x05,
  "&": 0x06, // arrow right
  "%": 0x07, // arrow down
  "(": 0x08,
  ")": 0x09,
  "*": 0x0a,
  "+": 0x0b,
  ",": 0x0c,
  "-": 0x0d,
  ".": 0x0e,
  "/": 0x0f,
  "0": 0x10,
  "1": 0x11,
  "2": 0x12,
  "3": 0x13,
  "4": 0x14,
  "5": 0x15,
  "6": 0x16,
  "7": 0x17,
  "8": 0x18,
  "9": 0x19,
  ":": 0x1a,
  ";": 0x1b,
  "<": 0x1c,
  "=": 0x1d,
  ">": 0x1e,
  "?": 0x1f,
  "@": 0x20,
  "A": 0x21,
  "B": 0x22,
  "C": 0x23,
  "D": 0x24,
  "E": 0x25,
  "F": 0x26,
  "G": 0x27,
  "H": 0x28,
  "I": 0x29,
  "J": 0x2a,
  "K": 0x2b,
  "L": 0x2c,
  "M": 0x2d,
  "N": 0x2e,
  "O": 0x2f,
  "P": 0x30,
  "Q": 0x31,
  "R": 0x32,
  "S": 0x33,
  "T": 0x34,
  "U": 0x35,
  "V": 0x36,
  "W": 0x37,
  "X": 0x38,
  "Y": 0x39,
  "Z": 0x3a,
  "[": 0x3b,
  "\\": 0x3c,
  "]": 0x3d,
  "^": 0x3e,
  "_": 0x3f,
  "`": 0x40,
  "a": 0x41,
  "b": 0x42,
  "c": 0x43,
  "d": 0x44,
  "e": 0x45,
  "f": 0x46,
  "g": 0x47,
  "h": 0x48,
  "i": 0x49,
  "j": 0x4a,
  "k": 0x4b,
  "l": 0x4c,
  "m": 0x4d,
  "n": 0x4e,
  "o": 0x4f,
  "p": 0x50,
  "q": 0x51,
  "r": 0x52,
  "s": 0x53,
  "t": 0x54,
  "u": 0x55,
  "v": 0x56,
  "w": 0x57,
  "x": 0x58,
  "y": 0x59,
  "z": 0x5a,
  "{": 0x5b,
  "|": 0x5c,
  "}": 0x5d,
  "~": 0x5e,
  //"": 0x5f,

};



