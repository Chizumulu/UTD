# 1-H-3-5 fixed performance reference

Status: measured-with-variability-warning
Historical: fb08f0af422bf811d4948669c31577db3ba710bd
Reference: def5d8846167fcb2699ac5f416028e46afebe2d4
Valid reports: 20; attempts: 20; retries: 0; rejected: 0

Warnings: mobile historical: high-variability

## mobile

| Metric | Historical median | Reference median | Reference min | Reference max | Range % |
|---|---:|---:|---:|---:|---:|
| score | 53 | 59 | 58 | 62 | 6.78 |
| fcp | 5138.38 | 4825.58 | 3806.75 | 4894.11 | 22.53 |
| lcp | 8084.34 | 7611.41 | 6867.48 | 7765.54 | 11.8 |
| tbt | 82 | 69.5 | 66 | 111.5 | 65.47 |
| cls | 0.2 | 0.13 | 0.13 | 0.13 | 0 |
| speedIndex | 5138.38 | 4825.58 | 3806.75 | 4894.11 | 22.53 |
| jsExecution | 468.64 | 451.52 | 426.92 | 477.71 | 11.25 |
| mainThread | 3039.61 | 2664.41 | 2556.32 | 2843.52 | 10.78 |
| transfer | 1753241 | 1705913 | 1619987 | 1706123 | 5.05 |
| requests | 74 | 75 | 74 | 75 | 1.33 |

## desktop

| Metric | Historical median | Reference median | Reference min | Reference max | Range % |
|---|---:|---:|---:|---:|---:|
| score | 84 | 89 | 89 | 89 | 0 |
| fcp | 973.55 | 932.11 | 931.26 | 933.84 | 0.28 |
| lcp | 1609.95 | 1492.95 | 1453.69 | 1496.51 | 2.87 |
| tbt | 1.5 | 0 | 0 | 0.5 | — |
| cls | 0.18 | 0.14 | 0.14 | 0.14 | 0 |
| speedIndex | 1036.34 | 1005.02 | 988.14 | 1029.3 | 4.1 |
| jsExecution | 111.59 | 90.2 | 88.29 | 97.99 | 10.76 |
| mainThread | 774.62 | 738.05 | 681.32 | 757.98 | 10.39 |
| transfer | 1754604 | 1701704 | 1701696 | 1701758 | 0 |
| requests | 73 | 73 | 73 | 73 | 0 |

This is a fixed lab reference, not production field data. Variability warnings are retained, not filtered out. Future comparisons should use the reference SHA, not the historical SHA, and the same measurement protocol.
