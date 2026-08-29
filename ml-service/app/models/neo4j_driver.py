"""Neo4j driver configuration for knowledge graph"""
import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

class Neo4jService:
    """Service for interacting with Neo4j knowledge graph"""

    def __init__(self):
        self.uri = os.getenv("NEO4J_URI")
        self.username = os.getenv("NEO4J_USERNAME")
        self.password = os.getenv("NEO4J_PASSWORD")
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")
        self.driver = None

    def connect(self):
        """Establish connection to Neo4j"""
        if not self.driver:
            self.driver = GraphDatabase.driver(
                self.uri,
                auth=(self.username, self.password)
            )

    def close(self):
        """Close Neo4j connection"""
        if self.driver:
            self.driver.close()
            self.driver = None

    def execute_query(self, query, parameters=None):
        """Execute a Cypher query"""
        self.connect()
        with self.driver.session(database=self.database) as session:
            result = session.run(query, parameters or {})
            return [record for record in result]


neo4j_service = Neo4jService()
