// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{Connection, Error, Result};
mod models;
use chrono::offset::Local;
use fallible_iterator::FallibleIterator;
use models::Task;

const DB_PATH: &str = "tasks.db";

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn update_card(card_id: u32, card_text: Option<&str>, new_container_id: Option<u32>) -> String {
    let conn: Connection = Connection::open(DB_PATH).unwrap();

    let sql_stmnt: &str = if card_text.is_some() {
        let txt: &str = card_text.unwrap();
        &format!("UPDATE task SET text = '{txt}' WHERE id = {card_id};")
    } else {
        let cont_id: u32 = new_container_id.unwrap();
        &format!("UPDATE task SET container_id = {cont_id} WHERE id = {card_id};")
    };

    conn.execute(sql_stmnt, ()).unwrap();
    format!("Hello, from update_card! card_id={}", card_id)
}

#[tauri::command]
fn delete_card(card_id: u32) -> String {
    let conn: Connection = Connection::open(DB_PATH).unwrap();
    conn.execute(
        &format!(
            "DELETE from task
            WHERE id = {card_id};"
        ),
        (),
    )
    .unwrap();
    format!("Hello, from delete_card! card_id={}", card_id)
}

#[tauri::command]
fn create_card(card_text: String, card_status: String, container_id: u32) -> Task {
    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn
        .prepare(&format!(
            "INSERT INTO task (text, status, container_id) VALUES
            ('{card_text}', '{card_status}', '{container_id}') RETURNING task.id"
        ))
        .unwrap();

    let rows = stmt.query([]).unwrap();
    let res: Vec<u32> = rows.map(|r| r.get(0)).collect().unwrap();

    println!(
        "Hello, from create_card! card_text={}, card_status={}, container_id={}, res={}",
        card_text, card_status, container_id, res[0]
    );
    Task {
        id: res[0],
        text: card_text,
        status: card_status,
        container_id: container_id,
    }
}

fn create_init_containers(conn: &Connection) -> Result<(), Error> {
    let statuses = ["todo", "doing", "done"];
    let today_date = Local::now().to_string();
    for status in statuses {
        conn.execute(
            &format!("INSERT INTO container (status, date) VALUES ('{status}', '{today_date}');"),
            (),
        )?;
    }
    Ok(())
}

fn try_to_create_db(conn: &Connection) -> Result<(), Error> {
    conn.execute(
        "CREATE TABLE container (
            id    INTEGER PRIMARY KEY,
            status  TEXT NOT NULL,
            date DATE NOT NULL
        );
        ",
        (),
    )?;
    conn.execute(
        "CREATE TABLE task (
            id    INTEGER PRIMARY KEY,
            text  TEXT NOT NULL,
            status  TEXT NOT NULL,
            container_id INT,
            FOREIGN KEY (container_id) REFERENCES container
        );
        ",
        (),
    )?;
    Ok(())
}

#[tauri::command]
fn get_cards() -> Vec<Task> {
    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn.prepare("SELECT id, text, status FROM task").unwrap();
    let task_iter = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                text: row.get(1)?,
                status: row.get(2)?,
                container_id: row.get(3)?,
            })
        })
        .unwrap();
    let mut tasks: Vec<Task> = Vec::new();
    for task in task_iter {
        tasks.push(task.unwrap());
    }
    tasks
}

fn main() {
    let conn = Connection::open(DB_PATH).unwrap();

    match try_to_create_db(&conn) {
        Ok(_res) => match create_init_containers(&conn) {
            Ok(_res) => println!("INFO: ok creation of tables and init containers."),
            Err(error) => println!(
                "ERROR: ok creation of tables, but error init containers: {:?}",
                error
            ),
        },
        Err(error) => println!("ERROR: create db res: {:?}", error),
    };

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            update_card,
            get_cards,
            create_card,
            delete_card,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
