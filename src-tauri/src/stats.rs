use rusqlite::{Connection, Error, Result};

pub fn get_some_stats(conn: &Connection) {
    println!("herllo from stats");
}
