# Dynamic Pricing v2 Local Verification

Run date: 2026-08-21

Configured database check:

- Item records: 666
- Active competitor benchmarks: 2523
- Database writes: none
- Route used for verification: deterministic local route, 12 miles, 35 minutes

| Scenario | Classification | API | Benchmark | Reference profile | Items | Volume m3 | Weight kg | Handling min | Crew | Control | Demand bps | Adjustment | Benchmark | Final | Saving | Result |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Individual item quantity 1 | INDIVIDUAL_ITEMS | 200 | cmsv824lc0091usw2la9xtu9o | individual-few-items-v2 | 1 | 0.235 | 8 | 8 | 1 | crew | 5000 | 90% | £63.00 | £56.70 | 10% | FIXED |
| Individual item quantity 5 | INDIVIDUAL_ITEMS | 200 | cmsv824lc0091usw2la9xtu9o | individual-few-items-v2 | 5 | 1.175 | 40 | 40 | 1 | quantity | 16667 | 110% | £63.00 | £63.00 | 0% | FIXED |
| Small/light single item | INDIVIDUAL_ITEMS | 200 | cmsv824lc008vusw2east1yq2 | individual-single-item-v2 | 1 | 0.235 | 8 | 8 | 1 | quantity | 10000 | 100% | £63.00 | £63.00 | 0% | FIXED |
| Large/heavy single item | INDIVIDUAL_ITEMS | 200 | cmsv824lc008vusw2east1yq2 | individual-single-item-v2 | 1 | 0.66 | 75 | 24 | 2 | weight | 19737 | 110% | £63.00 | £63.00 | 0% | FIXED |
| One-person inventory | MAN_AND_VAN | 200 | cmsv824lc00a1usw2l9ybk91b | man-and-van-normal-load-v2 | 3 | 0.165 | 45 | 15 | 1 | crew | 5000 | 90% | £63.00 | £51.03 | 19% | FIXED |
| Two-person heavy item | MAN_AND_VAN | 200 | cmsv824lc00a1usw2l9ybk91b | man-and-van-normal-load-v2 | 1 | 0.66 | 75 | 24 | 2 | crew | 10000 | 100% | £63.00 | £56.70 | 10% | FIXED |
| Light 1-bedroom inventory | FULL_HOUSE | 200 | cmsv824la003ausw2jp5sak2d | full-house-1-bedroom-v2 | 6 | 0.33 | 90 | 30 | 1 | crew | 5000 | 90% | £355.55 | £288.00 | 19% | FIXED |
| Reference 1-bedroom inventory | FULL_HOUSE | 200 | cmsv824la003ausw2jp5sak2d | full-house-1-bedroom-v2 | 28 | 5.1 | 610 | 216 | 2 | volume | 10000 | 100% | £355.55 | £320.00 | 10% | FIXED |
| Small student move | STUDENT_MOVE | 200 | cmsv824lc00b1usw28c6shsus | student-move-few-items-v2 | 2 | 0.11 | 30 | 10 | 1 | crew | 5000 | 90% | £63.00 | £51.03 | 19% | FIXED |
| Larger student move | STUDENT_MOVE | 200 | cmsv824lc00b1usw28c6shsus | student-move-few-items-v2 | 13 | 0.895 | 188 | 68 | 1 | weight | 10444 | 101.33% | £63.00 | £57.45 | 9% | FIXED |
| Small man-and-van inventory | MAN_AND_VAN | 200 | cmsv824lc00a1usw2l9ybk91b | man-and-van-normal-load-v2 | 2 | 0.11 | 30 | 10 | 1 | crew | 5000 | 90% | £63.00 | £51.03 | 19% | FIXED |
| Larger man-and-van inventory | MAN_AND_VAN | 200 | cmsv824lc00a1usw2l9ybk91b | man-and-van-normal-load-v2 | 9 | 1.09 | 145 | 54 | 1 | quantity | 9000 | 97% | £63.00 | £55.00 | 13% | FIXED |
| Standard business inventory | BUSINESS_REMOVAL | 200 | none | business-removal-office-v2 | 16 | 2.876 | 328 | 114 | 2 | n/a | n/a | n/a | n/a | n/a | n/a | MANUAL_REVIEW: MISSING_BENCHMARK |
| Heavier business inventory | BUSINESS_REMOVAL | 200 | none | business-removal-office-v2 | 30 | 5.776 | 646 | 220 | 2 | n/a | n/a | n/a | n/a | n/a | n/a | MANUAL_REVIEW: MISSING_BENCHMARK |

Business removal note: the configured database had no active `office-move` competitor benchmarks at verification time, so the canonical engine correctly returned `MISSING_BENCHMARK` instead of borrowing a house, student, individual, man-and-van, or `other` benchmark.
