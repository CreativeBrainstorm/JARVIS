"""
JARVIS AI Agent — Long-Term Memory
=====================================
Vector store backed by ChromaDB for semantic search,
RAG retrieval, and persistent knowledge storage.
"""

from typing import Any

from loguru import logger

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    logger.warning("ChromaDB not available — long-term memory disabled")


class LongTermMemory:
    """
    Long-term memory using ChromaDB vector store.

    Stores facts, knowledge, and conversation insights
    that can be retrieved via semantic search.
    """

    def __init__(self, persist_directory: str = "./data/chroma"):
        self._client = None
        self._collection = None
        self._persist_dir = persist_directory

        if CHROMA_AVAILABLE:
            try:
                self._client = chromadb.PersistentClient(
                    path=persist_directory,
                    settings=ChromaSettings(anonymized_telemetry=False),
                )
                self._collection = self._client.get_or_create_collection(
                    name="jarvis_knowledge",
                    metadata={"description": "JARVIS long-term knowledge store"},
                )
                count = self._collection.count()
                logger.info(f"Long-term memory initialized | Documents: {count}")
            except Exception as e:
                logger.error(f"Failed to initialize ChromaDB: {e}")
                self._client = None
                self._collection = None

    @property
    def is_available(self) -> bool:
        """Whether long-term memory is functional."""
        return self._collection is not None

    def store(
        self,
        text: str,
        metadata: dict[str, Any] | None = None,
        doc_id: str | None = None,
    ) -> str | None:
        """
        Store a piece of knowledge in the vector store.

        Args:
            text: The text content to store
            metadata: Optional metadata (source, type, timestamp, etc.)
            doc_id: Optional document ID (auto-generated if not provided)

        Returns:
            The document ID, or None if storage failed
        """
        if not self.is_available:
            logger.warning("LTM: Cannot store — ChromaDB not available")
            return None

        try:
            import uuid
            doc_id = doc_id or str(uuid.uuid4())
            meta = metadata or {}
            meta.setdefault("stored_at", str(__import__("datetime").datetime.now()))

            self._collection.add(
                documents=[text],
                metadatas=[meta],
                ids=[doc_id],
            )
            logger.debug(f"LTM: Stored document {doc_id[:8]}...")
            return doc_id

        except Exception as e:
            logger.error(f"LTM: Failed to store document: {e}")
            return None

    def search(
        self,
        query: str,
        n_results: int = 5,
        where: dict | None = None,
    ) -> list[dict[str, Any]]:
        """
        Search for relevant documents using semantic similarity.

        Args:
            query: Search query text
            n_results: Maximum number of results
            where: Optional metadata filter

        Returns:
            List of results with 'text', 'metadata', 'distance'
        """
        if not self.is_available:
            return []

        try:
            params: dict[str, Any] = {
                "query_texts": [query],
                "n_results": min(n_results, self._collection.count() or 1),
            }
            if where:
                params["where"] = where

            results = self._collection.query(**params)

            documents = []
            for i in range(len(results["ids"][0])):
                documents.append({
                    "id": results["ids"][0][i],
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0,
                })

            logger.debug(f"LTM: Found {len(documents)} results for query: {query[:50]}...")
            return documents

        except Exception as e:
            logger.error(f"LTM: Search failed: {e}")
            return []

    def delete(self, doc_id: str) -> bool:
        """Delete a document by ID."""
        if not self.is_available:
            return False
        try:
            self._collection.delete(ids=[doc_id])
            return True
        except Exception as e:
            logger.error(f"LTM: Delete failed: {e}")
            return False

    @property
    def count(self) -> int:
        """Number of documents in the store."""
        if not self.is_available:
            return 0
        return self._collection.count()
