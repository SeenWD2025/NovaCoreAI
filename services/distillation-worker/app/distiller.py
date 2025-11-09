"""Memory distillation logic."""
import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session
import uuid

from app.config import settings

logger = logging.getLogger(__name__)


class MemoryDistiller:
    """Service for distilling and promoting memories."""
    
    def __init__(self, db: Session):
        """Initialize distiller with database session."""
        self.db = db
    
    def run_distillation(self) -> Dict[str, Any]:
        """
        Run full memory distillation process.
        
        This process:
        1. Fetches recent reflections
        2. Groups by topic/tags
        3. Calculates aggregate scores
        4. Creates distilled knowledge entries
        5. Promotes ITM to LTM based on access count
        6. Cleans up expired memories
        
        Returns:
            Summary of distillation process
        """
        logger.info("Starting memory distillation process")
        
        try:
            summary = {
                "started_at": datetime.utcnow().isoformat(),
                "reflections_processed": 0,
                "knowledge_distilled": 0,
                "memories_promoted": 0,
                "memories_expired": 0,
                "errors": []
            }
            
            # Step 1: Fetch recent reflections (last 24 hours)
            reflections = self.fetch_recent_reflections(hours=24)
            summary["reflections_processed"] = len(reflections)
            logger.info(f"Fetched {len(reflections)} recent reflections")
            
            # Step 2: Group reflections by topic
            grouped = self.group_reflections_by_topic(reflections)
            logger.info(f"Grouped reflections into {len(grouped)} topics")
            
            # Step 3: Create distilled knowledge
            for topic, reflection_group in grouped.items():
                try:
                    if self.create_distilled_knowledge(topic, reflection_group):
                        summary["knowledge_distilled"] += 1
                except Exception as e:
                    logger.error(f"Failed to distill knowledge for topic '{topic}': {e}")
                    summary["errors"].append(f"Distillation error for '{topic}': {str(e)}")
            
            # Step 4: Promote ITM to LTM
            promoted = self.promote_itm_to_ltm()
            summary["memories_promoted"] = promoted
            logger.info(f"Promoted {promoted} memories from ITM to LTM")
            
            # Step 5: Clean up expired memories
            expired = self.cleanup_expired_memories()
            summary["memories_expired"] = expired
            logger.info(f"Cleaned up {expired} expired memories")
            
            summary["completed_at"] = datetime.utcnow().isoformat()
            summary["status"] = "success"
            
            logger.info("Memory distillation completed successfully")
            return summary
            
        except Exception as e:
            logger.error(f"Memory distillation failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "started_at": datetime.utcnow().isoformat()
            }
    
    def fetch_recent_reflections(self, hours: int = 24) -> List[Dict[str, Any]]:
        """
        Fetch reflections from the last N hours.
        
        Args:
            hours: Number of hours to look back
            
        Returns:
            List of reflection data
        """
        try:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            
            query = text("""
                SELECT
                    id, user_id, session_id, input_context, output_response,
                    outcome, emotional_weight, confidence_score, tags, created_at
                FROM memories
                WHERE type = 'reflection'
                AND created_at >= :cutoff
                ORDER BY created_at DESC
            """)
            
            results = self.db.execute(query, {"cutoff": cutoff}).fetchall()
            
            reflections = []
            for row in results:
                reflections.append({
                    "id": str(row[0]),
                    "user_id": str(row[1]),
                    "session_id": str(row[2]) if row[2] else None,
                    "input_context": row[3],
                    "output_response": row[4],
                    "outcome": row[5],
                    "emotional_weight": row[6],
                    "confidence_score": row[7],
                    "tags": row[8] or [],
                    "created_at": row[9]
                })
            
            return reflections
            
        except Exception as e:
            logger.error(f"Failed to fetch reflections: {e}")
            return []
    
    def group_reflections_by_topic(
        self,
        reflections: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group reflections by common topics/tags.
        
        Args:
            reflections: List of reflection data
            
        Returns:
            Dictionary mapping topics to reflection groups
        """
        grouped = {}
        
        for reflection in reflections:
            tags = reflection.get("tags", [])
            
            # Use first non-reflection tag as topic, or "general" if none
            topic = "general"
            for tag in tags:
                if tag not in ["reflection", "self-assessment", "alignment"]:
                    topic = tag
                    break
            
            if topic not in grouped:
                grouped[topic] = []
            
            grouped[topic].append(reflection)
        
        return grouped
    
    def create_distilled_knowledge(
        self,
        topic: str,
        reflections: List[Dict[str, Any]]
    ) -> bool:
        """
        Create distilled knowledge entry from grouped reflections.
        
        Args:
            topic: Topic name
            reflections: Reflections for this topic
            
        Returns:
            True if created successfully, False otherwise
        """
        try:
            # Skip if too few reflections
            if len(reflections) < 2:
                logger.debug(f"Skipping topic '{topic}' - too few reflections")
                return False
            
            # Calculate aggregate scores
            emotional_weights = [r.get("emotional_weight", 0) for r in reflections if r.get("emotional_weight")]
            confidence_scores = [r.get("confidence_score", 0) for r in reflections if r.get("confidence_score")]
            
            if not emotional_weights or not confidence_scores:
                logger.debug(f"Skipping topic '{topic}' - missing scores")
                return False
            
            avg_emotional_weight = sum(emotional_weights) / len(emotional_weights)
            avg_confidence = sum(confidence_scores) / len(confidence_scores)
            
            # Check promotion criteria
            significant_emotion = abs(avg_emotional_weight) > settings.emotional_weight_threshold
            high_confidence = avg_confidence > settings.confidence_threshold
            
            # Success rate
            successes = sum(1 for r in reflections if r.get("outcome") == "success")
            success_rate = successes / len(reflections)
            
            if not (significant_emotion or high_confidence) or success_rate < 0.5:
                logger.debug(f"Topic '{topic}' doesn't meet distillation criteria")
                return False
            
            # Extract principle from reflections
            principle = self.extract_principle(topic, reflections)
            
            # Get user_id from first reflection
            user_id = reflections[0].get("user_id")
            
            # Create distilled knowledge entry
            knowledge_id = str(uuid.uuid4())
            source_ids = [r["id"] for r in reflections]
            
            query = text("""
                INSERT INTO distilled_knowledge (
                    id, user_id, source_reflections, topic, principle,
                    confidence, created_at
                ) VALUES (
                    :id, :user_id, :source_reflections, :topic, :principle,
                    :confidence, :created_at
                )
            """)
            
            self.db.execute(query, {
                "id": knowledge_id,
                "user_id": user_id,
                "source_reflections": source_ids,
                "topic": topic,
                "principle": principle,
                "confidence": avg_confidence,
                "created_at": datetime.utcnow()
            })
            
            self.db.commit()
            
            logger.info(f"Created distilled knowledge for topic '{topic}' from {len(reflections)} reflections")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create distilled knowledge: {e}")
            return False
    
    def extract_principle(
        self,
        topic: str,
        reflections: List[Dict[str, Any]]
    ) -> str:
        """
        Extract key principle from reflections.
        
        Args:
            topic: Topic name
            reflections: Reflections for this topic
            
        Returns:
            Extracted principle
        """
        # Simple extraction: combine key insights
        insights = []
        
        for reflection in reflections[:3]:  # Use top 3
            output = reflection.get("output_response", "")
            # Extract from self-assessment (Q3: How could I improve?)
            if "A3:" in output:
                parts = output.split("A3:")
                if len(parts) > 1:
                    insight = parts[1].split("\n")[0].strip()
                    if insight and insight not in insights:
                        insights.append(insight)
        
        if insights:
            principle = f"For {topic}: " + "; ".join(insights[:2])
        else:
            principle = f"General insights about {topic} from {len(reflections)} interactions"
        
        return principle[:500]  # Limit length
    
    def promote_itm_to_ltm(self) -> int:
        """
        Promote high-access ITM memories to LTM.
        
        Returns:
            Number of memories promoted
        """
        try:
            query = text("""
                UPDATE memories
                SET tier = 'ltm', expires_at = NULL
                WHERE tier = 'itm'
                AND access_count >= :threshold
                AND constitution_valid = true
                AND (expires_at IS NULL OR expires_at > NOW())
            """)
            
            result = self.db.execute(query, {
                "threshold": settings.promotion_access_threshold
            })
            
            self.db.commit()
            
            return result.rowcount
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to promote memories: {e}")
            return 0
    
    def cleanup_expired_memories(self) -> int:
        """
        Clean up expired memories (soft deleted).
        
        Returns:
            Number of memories cleaned up
        """
        try:
            # Actually just mark as expired if not already
            query = text("""
                UPDATE memories
                SET expires_at = NOW()
                WHERE expires_at IS NOT NULL
                AND expires_at < NOW()
                AND tier != 'ltm'
            """)
            
            result = self.db.execute(query)
            self.db.commit()
            
            return result.rowcount
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to cleanup expired memories: {e}")
            return 0
