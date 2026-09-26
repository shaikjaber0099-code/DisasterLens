from fastapi import APIRouter
from backend.app.eval_harness import run_evaluation_benchmark

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

@router.get("/run")
def get_evaluation_results():
    """Runs and returns held-out benchmark evaluation results, baseline comparisons, and calibration reliability."""
    return run_evaluation_benchmark()
