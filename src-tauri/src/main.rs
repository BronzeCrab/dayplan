// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{Connection, Result};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    let conn = Connection::open_in_memory().unwrap();
    format!("Hello, {}! You've been greeted from Rust! {:?}", name, conn)
}
#[tauri::command]
fn update_card(card_text: &str) -> String {
    println!("update_card_log");
    format!("Hello, from update_card! card_text={}", card_text)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, update_card])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
