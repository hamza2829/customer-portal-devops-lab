"""Summarize observed JUnit results and enforce story coverage."""

import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

SUITES = {
    "api-unit": "api/test/portal.unit.spec.ts",
    "api-integration": "api/test/portal.integration.spec.ts",
    "web-unit": "web/test/portal.spec.tsx",
    "report-unit": "report/tests/test_report.py",
    "smoke": "web/smoke/portal.spec.ts",
}
STORIES = {
    "S01": "Sign in and out",
    "S02": "View my open orders",
    "S03": "Download a monthly report",
    "S04": "Manage customers",
    "S05": "Manage orders",
    "S06": "Restrict admin operations",
    "S07": "Reject invalid inputs",
    "S08": "Check availability and API docs",
}
STORY_ID = re.compile(r"(?<![a-zA-Z0-9])S[0-9]{2}(?![a-zA-Z0-9])")


def main(directory: Path) -> int:
    counts = {suite: Counter() for suite in SUITES}
    coverage = {story: Counter() for story in STORIES}
    problems = []
    details = ["Suite\tStory\tResult\tTest"]

    for suite in SUITES:
        xml_file = directory / f"{suite}.xml"
        if not xml_file.is_file():
            problems.append(f"Missing {suite}.xml.")
            continue
        cases = ET.parse(xml_file).findall(".//testcase")
        if not cases:
            problems.append(f"{suite} reported zero test cases.")
        for case in cases:
            name = case.attrib["name"]
            ids = STORY_ID.findall(name)
            story = ids[0] if len(ids) == 1 and ids[0] in STORIES else ""
            if not story:
                problems.append(f"{suite} test must contain one known story ID ({name}).")
            if case.find("failure") is not None or case.find("error") is not None:
                result = "Fail"
            elif case.find("skipped") is not None:
                result = "Skipped"
            else:
                result = "Pass"
            counts[suite][result] += 1
            if story:
                coverage[story][suite, result] += 1
            details.append(f"{suite}\t{story}\t{result}\t{name}")

    total = sum(sum(suite.values()) for suite in counts.values())
    passed = sum(suite["Pass"] for suite in counts.values())
    if total - sum(counts["smoke"].values()) < 50:
        problems.append("Fewer than 50 unit and integration tests ran across the three services.")
    if counts["smoke"]["Pass"] < 8:
        problems.append("Fewer than eight smoke tests passed.")
    if passed != total:
        problems.append("One or more tests failed or were skipped.")

    lines = [
        f"**{passed}/{total} tests passed.**",
        "",
        "| Suite | Passed | Failed | Skipped |",
        "| --- | ---: | ---: | ---: |",
    ]
    for suite, result in counts.items():
        lines.append(f'| {suite} | {result["Pass"]} | {result["Fail"]} | {result["Skipped"]} |')
    lines.extend(["", "| Story | Tests by suite | Result |", "| --- | --- | --- |"])
    for story, label in STORIES.items():
        by_suite = coverage[story]
        links = []
        for suite, path in SUITES.items():
            count = sum(value for (key, _), value in by_suite.items() if key == suite)
            if count:
                links.append(f"[{suite}]({path}) ({count})")
        if not links:
            problems.append(f"{story} has no tests.")
        result = "Pass" if links and all(state == "Pass" for _, state in by_suite) else "Fail"
        lines.append(f"| {story} · {label} | {', '.join(links) or 'None'} | {result} |")
    if problems:
        lines.extend(["", *[f"- {problem}" for problem in problems]])

    (directory / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (directory / "test-cases.tsv").write_text("\n".join(details) + "\n", encoding="utf-8")
    return int(bool(problems))


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
