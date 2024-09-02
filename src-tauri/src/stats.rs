use crate::models::{BarStats, LineStats};
use rusqlite::Connection;

pub const DB_PATH: &str = "tasks.db";

fn get_index_of_status(status: &str) -> u32 {
    match status {
        "todo" => 0,
        "doing" => 1,
        "done" => 2,
        _ => 42,
    }
}

#[tauri::command]
pub fn get_stats_4_bar() -> Vec<BarStats> {
    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn
        .prepare(&format!(
            "SELECT COUNT(task.id), container.status
            FROM task
            RIGHT JOIN container ON task.container_id = container.id
            GROUP BY container.status;"
        ))
        .unwrap();

    let stats_iter = stmt
        .query_map([], |row| {
            Ok(BarStats {
                count: row.get(0)?,
                status: row.get(1)?,
            })
        })
        .unwrap();
    let mut stats: Vec<BarStats> = Vec::new();
    for stat in stats_iter {
        stats.push(stat.unwrap());
    }

    stats.sort_by_key(|el: &BarStats| get_index_of_status(&el.status));

    stats
}

#[tauri::command]
pub fn get_stats_4_line() -> Vec<LineStats> {
    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn
        .prepare(&format!(
            "SELECT COUNT(task.id), container.status, daydate.date
            FROM task
            RIGHT JOIN container ON task.container_id = container.id
            INNER JOIN daydate ON container.date_id = daydate.id
            GROUP BY container.status, daydate.date
            ORDER BY daydate.date ASC;"
        ))
        .unwrap();

    let stats_iter = stmt
        .query_map([], |row| {
            Ok(LineStats {
                count: row.get(0)?,
                status: row.get(1)?,
                date: row.get(2)?,
            })
        })
        .unwrap();
    let mut stats: Vec<LineStats> = Vec::new();
    for stat in stats_iter {
        stats.push(stat.unwrap());
    }
    stats
}
