use rusqlite::Connection;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Stats {
    count: u32,
    status: String,
}

pub const DB_PATH: &str = "tasks.db";

#[tauri::command]
pub fn get_some_stats() -> Vec<Stats> {
    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn
        .prepare(&format!(
            "SELECT COUNT(task.id), container.status
            FROM task
            INNER JOIN container ON task.container_id = container.id
            GROUP BY container.status ORDER BY container.id;"
        ))
        .unwrap();

    let stats_iter = stmt
        .query_map([], |row| {
            Ok(Stats {
                count: row.get(0)?,
                status: row.get(1)?,
            })
        })
        .unwrap();
    let mut stats: Vec<Stats> = Vec::new();
    for stat in stats_iter {
        stats.push(stat.unwrap());
    }
    stats
}
