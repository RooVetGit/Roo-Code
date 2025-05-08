from datasets import Dataset, load_dataset
from typing import Any, Dict, cast
import json
import os


def main():
    swebench = cast(Dataset, load_dataset("princeton-nlp/SWE-bench", split="test"))

    # print(f"Count: {len(swebench)}")
    # print(f"Features: {swebench.features}")
    # print(f"Repos: {swebench.unique('repo')}")

    datasets_dir = "datasets"
    os.makedirs(datasets_dir, exist_ok=True)
    data_file = os.path.join(datasets_dir, "swebench_test.jsonl")

    if os.path.exists(data_file):
        print(f"dataset already exists in {data_file}")
        return

    with open(data_file, "w") as f:
        for i, row in enumerate(swebench):
            example = dict(cast(Dict[str, Any], row))
            f.write(json.dumps(example) + "\n")
            if i % 100 == 0:
                print(f"Processed {i} rows...")

    print(f"dataset successfully written to {data_file}")


if __name__ == "__main__":
    main()
