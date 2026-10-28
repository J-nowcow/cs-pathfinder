# Reading hierarchy and concept figures

User feedback identified text density from weak hierarchy and too few explanatory
figures. A local desktop baseline confirmed default reading h2/h3 weights of 400;
n01 had no figure, and the first figures in n35/n27 started about 1929/2059px below
the page top. Typography modes assign heading faces but the default reading h2/h3
had no explicit weight following preflight. The fix restores 700/600 in the
presentation/friendly reading modes, preserving the book mode's 400-weight serif.

PMP and certificate takeaways now have a small role label and a distinct margin
and background; original text is unchanged. PMP explanatory prose has its own
section heading. Main reading section headings receive a top separator and
spacing. The paper palette, fonts, font choices and reading-size choices remain.

Three new original server-rendered SVG figures explain existing PMP content near
the top: n01 contrasts output/outcome/benefit, n27 maps cause/event/impact with a
reassessment return path, and n35 compares PV/EV/AC on one scale. They are not
copied diagrams, quiz images, generated stock illustrations or client animations.
Each includes an accessible title/description and a visible caption. A bounded
canvas allows horizontal reading without squeezing diagram labels indefinitely.

EVM uses the existing EVM_DEFAULTS and calculateEvm: BAC100,PV50,EV40,AC50;
CPI/SPI0.8 and CV/SV-10. The chart and ratios remain derived from the same data as
the authored lesson and existing lab, including the warning that SPI is not a
percentage of calendar delay. The outcome example is explicitly hypothetical;
arrows do not promise benefits from deployment. The risk map does not imply that
transferring some impact ends responsibility or risk reassessment.

Course JSON, sources/attribution, IDs, native lab logic, all study storage/backup
formats, previous offline packages, authentication, rollout and DB behavior stay
unchanged. No raster/image generation service, external image or new client
runtime is used. This user-requested content presentation work is separate from
the alternating refactor/optimize loop.

Validation covers original source identity, derived EVM geometry/values,
server-rendered accessible diagrams, reading hierarchy and font-mode preservation,
all existing interaction behavior and synthetic local save/restore. Browser and
payload measurements are local samples, not provider CPU/CU/billing telemetry.

Sources reviewed: [PMI EVM](https://www.pmi.org/blog/earned-value-management),
[PMI2026 ECO](https://www.pmi.org/-/media/pmi/documents/public/pdf/certifications/new-pmp-examination-content-outline-2026.pdf),
existing authored course and installed Motion Menu diagram vocabulary. No PMI
figure or exam question is reproduced.
