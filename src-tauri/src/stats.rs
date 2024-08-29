use rusqlite::{Connection, Error, Result};

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Stats {
    count: u32,
    task_id: u32,
    text: String,
    status: String,
    container_id: u32,
    date: String,
}

pub fn get_some_stats(conn: &Connection) -> Vec<Stats> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT COUNT(task.id), task.id, task.text, container.status, task.container_id,
            daydate.date
            FROM task
            INNER JOIN container ON task.container_id = container.id
            INNER JOIN daydate ON container.date_id = daydate.id
            GROUP BY daydate.date, container.status;"
        ))
        .unwrap();

    let stats_iter = stmt
        .query_map([], |row| {
            Ok(Stats {
                count: row.get(0)?,
                task_id: row.get(1)?,
                text: row.get(2)?,
                status: row.get(3)?,
                container_id: row.get(4)?,
                date: row.get(5)?,
            })
        })
        .unwrap();
    let mut stats: Vec<Stats> = Vec::new();
    for stat in stats_iter {
        stats.push(stat.unwrap());
    }
    stats
}
