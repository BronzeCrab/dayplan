// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{Connection, Error, Result};
mod models;
use models::Task;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
#[tauri::command]
fn update_card(card_text: &str, card_id: u32) -> String {
    format!(
        "Hello, from update_card! card_text={}, card_id={}",
        card_text, card_id
    )
}

fn try_to_create_db(conn: &Connection) -> Result<(), Error> {
    conn.execute(
        "CREATE TABLE task (
            id    INTEGER PRIMARY KEY,
            text  TEXT NOT NULL,
            status  TEXT NOT NULL
        )",
        (), // empty list of parameters.
    )?;
    Ok(())
}

fn main() {
    let conn = Connection::open("tasks.db").unwrap();

    let create_db_res = try_to_create_db(&conn);

    match create_db_res {
        Ok(res) => res,
        Err(error) => println!("create db res: {:?}", error),
    };

    let task = Task {
        id: 0,
        text: "Steven".to_string(),
        status: "lol".to_string(),
    };
    conn.execute(
        "INSERT INTO task (text, status) VALUES (?1, ?2)",
        (&task.text, &task.status),
    )
    .unwrap();

    let mut stmt = conn.prepare("SELECT id, text, status FROM task").unwrap();
    let task_iter = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                text: row.get(1)?,
                status: row.get(2)?,
            })
        })
        .unwrap();

    for task in task_iter {
        println!("Found task {:?}", task.unwrap());
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, update_card])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
