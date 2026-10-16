---
'@zenith/vite-plugin': minor
---

Support patched Vite ^6.4.4 and ^7.3.7; drop Vite 5 and vulnerable earlier patches.
Normal repository development/test tooling now requires Node 22 LTS >=22.12;
the published libraries' >=18.19 runtime floor is unchanged (DEC-040).

Run HTML compilation before Vite processes module scripts so virtual compiled
modules are actually bundled. Distinguish build command from a development
server started under NODE_ENV=production. Add real build/dev-server integration
coverage for both supported majors and reject incompatible peer installations.
