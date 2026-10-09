# Zenith v1.4.0 — گزارش باگ‌ها

## گروه ۱-۳
- actions: middleware race, override
- auth: cookie بدون max-age, refresh race
- cli: بدون باگ واضح

## گروه ۴-۶
- compiler: regex validation ناقص
- components: async-loader بدون timeout
- crud: fetch loop نامحدود

## گروه ۷-۹
- data: fetcher بدون retry limit
- dependency-graph: cyclic dependency بدون guard
- devtools: hook بدون cleanup

## گروه ۱۰-۱۲
- devtools-extension: بدون باگ واضح
- error-boundary: catch بدون log
- errors: message formatting ناقص

## گروه ۱۳-۱۵
- events: delegation با bubbling ناقص
- expressions: cache بدون eviction
- form: validation async بدون abort

## گروه ۱۶-۱۸
- i18n: fallback بدون locale validation
- permission: directive بدون deny default
- resource: directive بدون cleanup

## گروه ۱۹-۲۱
- router: outlet بدون unmount cleanup
- runtime: hydrate race
- scheduler: priority بدون limit

## گروه ۲۲-۲۴
- security: sanitizer regex ناقص
- service-worker: strategy بدون fallback
- ssr: render بدون stream flush

## گروه ۲۵-۲۷
- state: batch بدون rollback
- stateful: auth-view بدون destroy
- store: mutation بدون immutable check

## گروه ۲۸-۳۲
- suspense: بدون timeout
- transition: animate بدون cancel
- virtual-list: scroll بدون debounce
- vite-plugin: compile بدون cache
- vscode-extension: بدون باگ واضح
