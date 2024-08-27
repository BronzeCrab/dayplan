// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{Connection, Error, Result};
mod models;
use chrono::offset::Local;
use chrono::{NaiveDate, TimeDelta};
use fallible_iterator::FallibleIterator;
use models::Task;
mod stats;

const DB_PATH: &str = "tasks.db";

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
fn create_card(card_text: String, container_id: u32) -> Task {
    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn
        .prepare(&format!(
            "INSERT INTO task (text, container_id) VALUES
            ('{card_text}', '{container_id}') RETURNING task.id"
        ))
        .unwrap();

    let rows = stmt.query([]).unwrap();
    let res: Vec<u32> = rows.map(|r| r.get(0)).collect().unwrap();

    println!(
        "Hello, from create_card! card_text={}, container_id={}, task_id={}",
        card_text, container_id, res[0]
    );
    Task {
        id: res[0],
        text: card_text,
        status: "".to_string(),
        container_id: container_id,
        date: "".to_string(),
    }
}

fn create_daydate(conn: &Connection, date: &str) -> Result<u32, Error> {
    let mut stmt = conn
        .prepare(&format!(
            "INSERT INTO daydate (date) VALUES
            ('{date}') RETURNING daydate.id;"
        ))
        .unwrap();

    let rows = stmt.query([]).unwrap();
    match rows.map(|r| r.get(0)).collect::<Vec<u32>>() {
        Ok(res) => Ok(res[0]),
        Err(err) => Err(err),
    }
}

fn create_containers(conn: &Connection, date_id: u32) -> Result<Vec<u32>, Error> {
    let mut cont_ids: Vec<u32> = Vec::new();
    let statuses = ["todo", "doing", "done"];
    for status in statuses {
        let mut stmt = conn
            .prepare(&format!(
                "INSERT INTO container (status, date_id) VALUES ('{status}', '{date_id}') 
            RETURNING container.id;"
            ))
            .unwrap();

        let rows = stmt.query([]).unwrap();
        let res: Vec<u32> = rows.map(|r| r.get(0)).collect().unwrap();
        cont_ids.push(res[0]);
    }
    Ok(cont_ids)
}

fn try_to_create_db(conn: &Connection) -> Result<(), Error> {
    conn.execute(
        "CREATE TABLE daydate (
            id    INTEGER PRIMARY KEY,
            date DATE NOT NULL UNIQUE
        );
        ",
        (),
    )?;
    conn.execute(
        "CREATE TABLE container (
            id    INTEGER PRIMARY KEY,
            status  TEXT NOT NULL,
            date_id INT NOT NULL,
            FOREIGN KEY (date_id) REFERENCES daydate
        );
        ",
        (),
    )?;
    conn.execute(
        "CREATE TABLE task (
            id    INTEGER PRIMARY KEY,
            text  TEXT NOT NULL,
            container_id INT NOT NULL,
            FOREIGN KEY (container_id) REFERENCES container
        );
        ",
        (),
    )?;
    Ok(())
}

#[tauri::command]
fn get_cards(current_date: Option<String>) -> Vec<Task> {
    let curr_date: String = if current_date.is_some() {
        current_date.unwrap()
    } else {
        Local::now().date_naive().to_string()
    };

    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn
        .prepare(&format!(
            "SELECT task.id, task.text, container.status, task.container_id, daydate.date
            FROM task
            INNER JOIN container ON task.container_id = container.id
            INNER JOIN daydate ON container.date_id = daydate.id
            WHERE daydate.date = '{curr_date}';"
        ))
        .unwrap();
    let task_iter = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                text: row.get(1)?,
                status: row.get(2)?,
                container_id: row.get(3)?,
                date: row.get(4)?,
            })
        })
        .unwrap();
    let mut tasks: Vec<Task> = Vec::new();
    for task in task_iter {
        tasks.push(task.unwrap());
    }
    tasks
}

fn get_containers_ids(conn: &Connection, current_date: &str) -> Vec<u32> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT container.id
            FROM container
            INNER JOIN daydate ON container.date_id = daydate.id
            WHERE daydate.date = '{current_date}';"
        ))
        .unwrap();
    let cont_id_iter = stmt.query_map([], |row| Ok(row.get(0)?)).unwrap();
    let mut conteiner_ids: Vec<u32> = Vec::new();
    for cont_id in cont_id_iter {
        conteiner_ids.push(cont_id.unwrap());
    }
    conteiner_ids
}

#[tauri::command]
fn get_init_date() -> String {
    Local::now().date_naive().to_string()
}

#[tauri::command]
fn get_prev_or_next_date(current_date_str: &str, dir: &str) -> String {
    let curre_date = NaiveDate::parse_from_str(current_date_str, "%Y-%m-%d").unwrap();
    if dir == "right" {
        (curre_date + TimeDelta::days(1)).to_string()
    } else {
        (curre_date - TimeDelta::days(1)).to_string()
    }
}

#[tauri::command]
fn try_to_create_date_and_containers(current_date_str: &str) -> Vec<u32> {
    let conn: Connection = Connection::open(DB_PATH).unwrap();
    match create_daydate(&conn, current_date_str) {
        Ok(date_id) => match create_containers(&conn, date_id) {
            Ok(cont_ids) => {
                println!("INFO: ok of create date containers. Res: {:?}", cont_ids);
                cont_ids
            }
            Err(error) => {
                println!(
                    "ERROR: ok creation of date, but error create containers: {:?}",
                    error
                );
                Vec::new()
            }
        },
        Err(error) => {
            println!("ERROR: create date: {:?}", error);
            // in this case, we should just get containers ids of current_date:
            get_containers_ids(&conn, current_date_str)
        }
    }
}

fn main() {
    stats::lol();
    let conn = Connection::open(DB_PATH).unwrap();

    match try_to_create_db(&conn) {
        Ok(res) => println!("INFO: create db res: {:?}", res),
        Err(error) => println!("ERROR: create db: {:?}", error),
    };

    let today_date = Local::now().date_naive().to_string();
    try_to_create_date_and_containers(&today_date);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            update_card,
            get_cards,
            create_card,
            delete_card,
            get_init_date,
            get_prev_or_next_date,
            try_to_create_date_and_containers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
