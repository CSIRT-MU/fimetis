# Filesystem Metadata Analysis
The analysis of file systems is a crucial part of investigations of security incidents. The Fimetis tool enables the examination of file metadata (timestamps, ownership, etc.) and streamlines the processing of large volumes of such data. Using the visual controls, Fimetis makes it straightforward to navigate through the dataset. The analysis can also benefit from a set of pre-defined configurations identifying common file patterns and operations (like crontab rules, files with weak permissions, signs of compilation on the spot, etc.).

![ui](https://user-images.githubusercontent.com/1067311/110324418-344c8d00-8016-11eb-8911-a510e075e2ea.png)

The application UI runs in the browser and processes data indexed using ElasticSearch. While the application runs in all modern browsers, the best behavior is achieved with Chromium. See the ansible directory for a quick recipe to bootstrap the whole solution.

Basic concepts are described in the following paper:

* M. Beran, F. Hrdina, D. Kouřil, R. Ošlejšek, K. Zákopčanová. Exploratory Analysis of File System Metadata for Rapid Investigation of Security Incidents. In 2020 IEEE Symposium on Visualization for Cyber Security (VizSec). doi:10.1109/VizSec51108.2020.00008.

# Acknowledgements
The development was supported by the Security Research Programme of the Czech Republic 2015–2020 (BV III/1 – VS) granted by the Ministry of the Interior of the Czech Republic under No. VI20162019014 – Simulation, detection, and mitigation of cyber threats endangering critical infrastructure.
