use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Task {
    pub id: u32,
    pub text: String,
    pub status: String,
    pub container_id: u32,
}
