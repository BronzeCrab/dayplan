use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Task {
    pub id: u32,
    pub text: String,
    pub status: String,
    pub container_id: u32,
    pub date: String,
}

#[derive(Debug, Serialize)]
pub struct Container {
    pub id: u32,
    pub status: String,
    pub date_id: u32,
}

#[derive(Debug, Serialize)]
pub struct BarStats {
    pub count: u32,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct LineStats {
    pub count: u32,
    pub status: String,
    pub date: String,
}

#[derive(Debug, Serialize)]
pub struct PolarStats {
    pub count: u32,
    pub name: String,
}
