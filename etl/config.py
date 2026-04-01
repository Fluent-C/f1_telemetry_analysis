import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_HOST     = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT     = int(os.getenv('DB_PORT', 3306))
DB_NAME     = os.getenv('DB_NAME', 'f1db')
DB_USER     = os.getenv('DB_USER', 'f1user')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

FASTF1_CACHE_DIR = os.getenv('FASTF1_CACHE_DIR', './fastf1_cache')
ETL_WORKERS      = int(os.getenv('ETL_WORKERS', 8))
ETL_MAX_RETRIES  = int(os.getenv('ETL_MAX_RETRIES', 3))

def get_db_connection(local_infile: bool = True):
    """독립적인 DB 연결을 반환한다. 병렬 워커마다 호출해야 한다."""
    import pymysql
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        local_infile=local_infile,
        autocommit=False,
        charset='utf8mb4',
    )
