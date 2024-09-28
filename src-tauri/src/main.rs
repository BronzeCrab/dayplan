// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::usize;

use rusqlite::{Connection, Error, Result, Statement};
use std::fs::create_dir;
mod models;
use chrono::offset::Local;
use chrono::{NaiveDate, TimeDelta};
use fallible_iterator::FallibleIterator;
use models::{Container, Task};
mod stats;
use tauri::{Manager, State};

#[tauri::command]
fn update_card(
    state: State<DbConnection>,
    card_id: u32,
    card_text: Option<&str>,
    new_container_id: Option<u32>,
    new_categories_ids: Option<Vec<u32>>,
) -> Result<(), String> {
    if card_text.is_some() {
        let txt: &str = card_text.unwrap();
        if txt.trim() == "" {
            return Err("ERROR: cant update card with empty text!".to_string());
        }
    };

    let conn: &Connection = &state.db_conn;
    let sql_stmnt: &str = if card_text.is_some() {
        let txt: &str = card_text.unwrap();
        &format!("UPDATE task SET text = '{txt}' WHERE id = {card_id};")
    } else {
        let cont_id: u32 = new_container_id.unwrap();
        &format!("UPDATE task SET container_id = {cont_id} WHERE id = {card_id};")
    };

    if new_categories_ids.is_some() {
        let _ = delete_task_categories_relations(conn, card_id);
        let _ = create_task_categories_relations(conn, card_id, new_categories_ids.unwrap());
    }

    conn.execute(sql_stmnt, ()).unwrap();
    Ok(())
}

#[tauri::command]
fn delete_card(state: State<DbConnection>, card_id: u32) -> String {
    let conn: &Connection = &state.db_conn;
    let _ = delete_task_categories_relations(&conn, card_id);

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

fn delete_task_categories_relations(conn: &Connection, task_id: u32) -> Result<(), Error> {
    let _ = conn.execute(
        &format!("DELETE from task_category WHERE task_id = {task_id};"),
        (),
    );
    Ok(())
}

#[tauri::command]
fn create_card(
    state: State<DbConnection>,
    card_text: String,
    container_id: u32,
    categories_ids: Vec<u32>,
) -> Result<Task, &str> {
    if card_text.trim() == "" {
        return Err("ERROR: cant create card with empty text!");
    };
    let conn: &Connection = &state.db_conn;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT COUNT(*) FROM task WHERE container_id = {container_id};"
        ))
        .unwrap();
    let rows = stmt.query([]).unwrap();
    let container_order: u32 = rows.map(|r| r.get(0)).collect::<Vec<u32>>().unwrap()[0];

    let mut stmt = conn
        .prepare(&format!(
            "INSERT INTO task (text, container_id, container_order) VALUES
            ('{card_text}', {container_id}, {container_order}) RETURNING task.id;"
        ))
        .unwrap();

    let rows = stmt.query([]).unwrap();
    let res: Vec<u32> = rows.map(|r| r.get(0)).collect().unwrap();

    println!(
        "Hello, from create_card! card_text={}, container_id={}, task_id={}",
        card_text, container_id, res[0]
    );

    let task_id: u32 = res[0];
    let _ = create_task_categories_relations(&conn, task_id, categories_ids);

    Ok(Task {
        id: task_id,
        text: card_text,
        status: "".to_string(),
        container_id: container_id,
        date: "".to_string(),
        container_order: container_order,
    })
}

fn create_task_categories_relations(
    conn: &Connection,
    task_id: u32,
    categories_ids: Vec<u32>,
) -> Result<(), Error> {
    for category_id in categories_ids {
        let _ = conn.execute(
            &format!(
                "INSERT INTO task_category (task_id, category_id) VALUES 
                ({task_id}, {category_id});"
            ),
            (),
        );
    }
    Ok(())
}

fn create_daydate(conn: &Connection, date: &str) -> Result<u32, Error> {
    // here we have 3 cases:
    // 1 - db doesn't contain any is_active date
    // 2 - db do contain is_active date, but it's the same as date (do nothing)
    // 3 - db do contain is_active date, it's not the same

    // try to find active date:
    let mut stmt = conn
        .prepare(&format!(
            "SELECT daydate.id FROM daydate WHERE daydate.is_active = 1;"
        ))
        .unwrap();

    let rows = stmt.query([]).unwrap();
    match rows.map(|r| r.get(0)).collect::<Vec<u32>>() {
        Ok(res) => {
            if res.len() == 1 {
                let current_active_daydate_id: u32 = res[0];
                // here we need to check if active daydate is the same or not:
                let mut stmt = conn
                    .prepare(&format!(
                        "SELECT daydate.id FROM daydate WHERE daydate.date = '{date}'
                        AND 
                        daydate.is_active = 1;"
                    ))
                    .unwrap();
                let rows = stmt.query([]).unwrap();
                let res2 = rows.map(|r| r.get(0)).collect::<Vec<u32>>().unwrap();
                // here if we found, that current active date is not match:
                if res2.len() == 0 {
                    // here we have two cases:
                    // first - such daydate exist, but it's not active, other daydate is active
                    // second - such daydate doesn't exist, but there is some other active date
                    // in both cases first reset current active daydate:
                    let _ = conn.execute(
                        &format!(
                            "UPDATE daydate SET is_active = 0 WHERE 
                            is_active = 1 AND id = {current_active_daydate_id};"
                        ),
                        (),
                    );
                    // then, just try to create new active daydate:
                    let mut stmt = conn
                        .prepare(&format!(
                            "INSERT INTO daydate (date, is_active) VALUES 
                            ('{date}', 1) RETURNING daydate.id;"
                        ))
                        .unwrap();
                    let rows = stmt.query([]).unwrap();
                    match rows.map(|r| r.get(0)).collect::<Vec<u32>>() {
                        Ok(res) => return Ok(res[0]),
                        // or we should just update is_active to true in existing
                        Err(err) => {
                            println!("Indeed we are here, err is {:?}", err);
                            let mut stmt = conn
                                .prepare(&format!(
                                    "UPDATE daydate SET is_active = 1 WHERE 
                                    daydate.is_active = 0 AND daydate.date = '{date}'
                                    RETURNING daydate.id;"
                                ))
                                .unwrap();
                            let rows = stmt.query([]).unwrap();
                            let res = rows.map(|r| r.get(0)).collect::<Vec<u32>>().unwrap();
                            return Ok(res[0]);
                        }
                    }
                }
                // if we are here, then active daydate is the same as date param of
                // this func, just return current_active_daydate_id
                else if res2.len() == 1 {
                    return Ok(current_active_daydate_id);
                } else {
                    panic!("unreachable");
                }
            } else if res.len() > 1 {
                panic!("amount of active daydate is > 1")
            } else if res.len() == 0 {
                // here we need create new active daydate on date:
                let mut stmt = conn
                    .prepare(&format!(
                        "INSERT INTO daydate (date, is_active) VALUES 
                        ('{date}', 1) RETURNING daydate.id;"
                    ))
                    .unwrap();
                let rows = stmt.query([]).unwrap();
                match rows.map(|r| r.get(0)).collect::<Vec<u32>>() {
                    Ok(res) => return Ok(res[0]),
                    Err(err) => return Err(err),
                };
            } else {
                panic!("amount of active daydate is < 0")
            }
        }
        Err(err) => Err(err),
    }
}

fn get_and_set_containers(mut stmt: Statement, containers: &mut Vec<Container>) {
    let cont_iter = stmt
        .query_map([], |row| {
            Ok(Container {
                id: row.get(0)?,
                status: row.get(1)?,
                date_id: row.get(2)?,
            })
        })
        .unwrap();
    for cont in cont_iter {
        let _ = &containers.push(cont.unwrap());
    }
}

fn create_containers(conn: &Connection, date_id: u32) -> Result<Vec<Container>, Error> {
    // try to check if containers for this date are already created:
    let stmt: Statement<'_> = conn
        .prepare(&format!(
            "SELECT container.id, container.status, container.date_id
             FROM container WHERE container.date_id = {date_id};"
        ))
        .unwrap();

    let mut containers: Vec<Container> = Vec::new();

    get_and_set_containers(stmt, &mut containers);

    let statuses = ["todo", "doing", "done"];

    if containers.len() == statuses.len() {
        return Ok(containers);
    } else if containers.len() == 0 {
        for status in statuses {
            let stmt = conn
                .prepare(&format!(
                    "INSERT INTO container (status, date_id) VALUES ('{status}', '{date_id}') 
                RETURNING container.id, container.status, container.date_id;"
                ))
                .unwrap();

            get_and_set_containers(stmt, &mut containers);
        }
        return Ok(containers);
    } else {
        panic!("unreachable");
    }
}

fn create_categories(conn: &Connection) -> Result<Vec<u32>, Error> {
    let mut cat_ids: Vec<u32> = Vec::new();
    let categories = [
        "sport",
        "work",
        "education",
        "projects",
        "other",
        "relationships",
    ];
    for category in categories {
        let mut stmt = conn
            .prepare(&format!(
                "INSERT INTO category (name) VALUES ('{category}') 
            RETURNING category.id;"
            ))
            .unwrap();

        let rows = stmt.query([]).unwrap();
        match rows.map(|r| r.get(0)).collect::<Vec<u32>>() {
            Ok(res) => {
                cat_ids.push(res[0]);
            }
            Err(err) => return Err(err),
        };
    }
    Ok(cat_ids)
}

fn try_to_create_db_tables(conn: &Connection) -> Result<(), Error> {
    conn.execute(
        "CREATE TABLE daydate (
            id    INTEGER PRIMARY KEY,
            date DATE NOT NULL UNIQUE,
            is_active INTEGER
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
            container_order INT NOT NULL,
            FOREIGN KEY (container_id) REFERENCES container
        );
        ",
        (),
    )?;
    conn.execute(
        "CREATE TABLE category (
            id    INTEGER PRIMARY KEY,
            name  TEXT NOT NULL UNIQUE
        );
        ",
        (),
    )?;
    conn.execute(
        "CREATE TABLE task_category (
            task_id INT NOT NULL,
            category_id INT NOT NULL,
            PRIMARY KEY (task_id, category_id),
            FOREIGN KEY (task_id) REFERENCES task,
            FOREIGN KEY (category_id) REFERENCES category
        );
        ",
        (),
    )?;

    Ok(())
}

#[tauri::command]
fn get_cards(state: State<DbConnection>, current_date: String) -> Vec<Task> {
    let conn: &Connection = &state.db_conn;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT task.id, task.text, container.status, task.container_id, daydate.date, task.container_order
            FROM task
            INNER JOIN container ON task.container_id = container.id
            INNER JOIN daydate ON container.date_id = daydate.id
            WHERE daydate.date = '{current_date}' ORDER BY task.container_order ASC;"
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
                container_order: row.get(5)?,
            })
        })
        .unwrap();
    let mut tasks: Vec<Task> = Vec::new();
    for task in task_iter {
        tasks.push(task.unwrap());
    }
    tasks
}

fn get_containers_by_date_str(conn: &Connection, current_date: &str) -> Vec<Container> {
    let stmt = conn
        .prepare(&format!(
            "SELECT container.id, container.status, container.date_id
            FROM container
            INNER JOIN daydate ON container.date_id = daydate.id
            WHERE daydate.date = '{current_date}';"
        ))
        .unwrap();

    let mut containers: Vec<Container> = Vec::new();
    get_and_set_containers(stmt, &mut containers);
    containers
}

#[tauri::command]
fn get_categories(state: State<DbConnection>) -> Vec<[String; 2]> {
    let conn: &Connection = &state.db_conn;
    let mut stmt = conn
        .prepare(&format!("SELECT category.id, category.name FROM category;"))
        .unwrap();
    let cats_iter = stmt
        .query_map([], |row| {
            Ok([row.get::<usize, u32>(0)?.to_string(), row.get(1)?])
        })
        .unwrap();
    let mut cats: Vec<[String; 2]> = Vec::new();
    for cat in cats_iter {
        cats.push(cat.unwrap());
    }
    cats
}

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
fn try_to_create_date_and_containers(
    state: State<DbConnection>,
    current_date_str: &str,
) -> Vec<Container> {
    let conn: &Connection = &state.db_conn;
    match create_daydate(&conn, current_date_str) {
        Ok(date_id) => match create_containers(&conn, date_id) {
            Ok(containers) => {
                println!(
                    "INFO: ok of create daydate with date_id={date_id}, 
                    and containers. Res: {:?}",
                    containers
                );
                containers
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
            get_containers_by_date_str(&conn, current_date_str)
        }
    }
}

#[tauri::command]
fn upd_order_in_container(
    state: State<DbConnection>,
    container_id: u32,
    curr_draggable_ids: Vec<u32>,
) -> String {
    let conn: &Connection = &state.db_conn;

    for ind in 0..curr_draggable_ids.len() {
        let task_id: u32 = curr_draggable_ids[ind];
        let sql_stmnt = &format!(
            "UPDATE task SET container_order = {ind} WHERE container_id = {container_id} AND id = {task_id};");
        conn.execute(sql_stmnt, ()).unwrap();
    }

    format!(
        "Hello, from upd_order_in_container! container_id={}",
        container_id
    )
}

#[tauri::command]
fn get_curr_active_date(state: State<DbConnection>) -> String {
    let conn: &Connection = &state.db_conn;
    match try_to_select_active_date(conn) {
        Ok(res) => {
            if res.trim().to_lowercase() == "info: can't find active date".trim().to_lowercase() {
                panic!("Error: can't find active date")
            } else {
                res
            }
        }
        Err(_err) => "INFO: can't find active date".to_string(),
    }
}

fn try_to_select_active_date(conn: &Connection) -> Result<String, Error> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT daydate.date FROM daydate WHERE daydate.is_active = 1;"
        ))
        .unwrap();

    let rows = stmt.query([]).unwrap();
    match rows.map(|r| r.get(0)).collect::<Vec<String>>() {
        Ok(res) => {
            if res.len() == 1 {
                return Ok(res[0].clone());
            } else {
                return Ok("INFO: can't find active date".to_string());
            }
        }
        Err(err) => Err(err),
    }
}

struct DbConnection {
    db_conn: Connection,
}

unsafe impl Sync for DbConnection {}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let appdir = app.handle().path_resolver().app_data_dir().unwrap();
            println!("tauri setup, appdir is:");
            println!("{:?}", appdir);

            // create app folder:
            match create_dir(&appdir) {
                Ok(res) => println!("{:?}, OK created dir: {:?}", res, appdir),
                Err(err) => println!("ERROR created dir: {:?}, path: {:?}", err, appdir),
            }

            // create db folder:
            let new_db_dir = appdir.join("databases");
            match create_dir(&new_db_dir) {
                Ok(res) => println!("{:?}, OK created dir: {:?}", res, new_db_dir),
                Err(err) => println!("ERROR created dir: {:?}, path: {:?}", err, new_db_dir),
            }

            let path_to_db_file = new_db_dir.join("tasks.db");

            let conn: Connection = Connection::open(path_to_db_file).unwrap();

            match try_to_create_db_tables(&conn) {
                Ok(res) => println!("INFO: create db res: {:?}", res),
                Err(error) => println!("ERROR: create db: {:?}", error),
            };

            match create_categories(&conn) {
                Ok(res) => println!("INFO: create categories res: {:?}", res),
                Err(error) => println!("ERROR: create categories - {:?}", error),
            }

            match try_to_select_active_date(&conn) {
                Ok(res) => {
                    if res.trim().to_lowercase() == "info: can't find active date".trim().to_lowercase() {
                        let today_date: String = get_init_date();
                        match create_daydate(&conn, &today_date) {
                            Ok(res) => println!("INFO: created first active date on init, date is {today_date}, date_id is {res}"),
                            Err(err) => println!("ERROR: created first active date: {err}"),
                        }
                    }
                    else {
                        println!("Current active date is {:?}, do nothing", res);
                    }
                },
                Err(error) => println!("ERROR: try_to_select_active_date - {:?}", error),      
            }

            app.manage(DbConnection { db_conn: conn });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_card,
            get_cards,
            create_card,
            delete_card,
            get_curr_active_date,
            get_prev_or_next_date,
            try_to_create_date_and_containers,
            get_categories,
            upd_order_in_container,
            stats::get_stats_4_bar,
            stats::get_stats_4_line,
            stats::get_stats_4_polar,
            stats::get_container_status_by_id,
            stats::get_categories_names_by_task_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
