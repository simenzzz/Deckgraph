use pyo3::prelude::*;
use crate::{hash_password, create_hmac};

#[pyfunction]
fn py_hash_password(password: &str, salt: &str) -> String {
    hash_password(password, salt)
}

#[pyfunction]
fn py_create_hmac(key: &[u8], message: &[u8]) -> String {
    create_hmac(key, message)
}

#[pymodule]
fn crypto_utils(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(py_hash_password, m)?)?;
    m.add_function(wrap_pyfunction!(py_create_hmac, m)?)?;
    Ok(())
}
