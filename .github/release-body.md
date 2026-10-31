## VibeHub {{VERSION}} for Windows x64

> Download `VibeHub-Setup.exe` from this Release. The [acceptance matrix](https://github.com/ahmadkhanloo/VibeHub/blob/{{TAG}}/docs/validation/VibeHub_Release_Acceptance_Matrix.md) is the source for what has actually been verified.

VibeHub is a free, open-source desktop workspace for AI coding tools. It does not host models or provide a proxy service. Clean Windows 10 and 11 installation, upgrade and removal acceptance remain open unless the matrix records a passing run for the exact published build.

| File | Purpose |
|---|---|
| `VibeHub-Setup.exe` | Windows NSIS installer; it does not carry a Windows publisher (Authenticode) signature |
| `latest.json`, `VibeHub_*_x64-setup.nsis.zip`, and `.sig` files | Signed Tauri updater metadata and artifacts |
| `checksums-sha256.txt` | SHA-256 hashes for the public release assets |
| `VibeHub-*-source.zip` | Source snapshot for this tag |
| `VibeHub-SBOM.cdx.json` | CycloneDX software bill of materials |
| `LICENSE`, `THIRD_PARTY_LICENSES.md` | Project and third-party license notices |

Verify the installer SHA-256 against `checksums-sha256.txt` before running it. Updates are manual: open **Settings → Updates → Check now**. The updater archive is signed and VibeHub verifies it against its embedded public key.

{{PRERELEASE_NOTICE}}

{{GENERATED_NOTES}}

## فارسی

### VibeHub {{VERSION}} برای Windows x64

> فایل `VibeHub-Setup.exe` را از همین صفحهٔ Release بگیرید. [ماتریس پذیرش](https://github.com/ahmadkhanloo/VibeHub/blob/{{TAG}}/docs/validation/VibeHub_Release_Acceptance_Matrix.md) مرجع وضعیت واقعاً آزموده‌شده است.

VibeHub یک میزکار دسکتاپ رایگان و متن‌باز برای ابزارهای AI Coding است؛ میزبان مدل یا سرویس پروکسی نیست. پذیرش نصب، ارتقا و حذف روی ویندوز ۱۰ و ۱۱ تمیز باز است، مگر اینکه ماتریس برای همین build منتشرشده اجرای موفقی ثبت کرده باشد.

| فایل | کاربرد |
|---|---|
| `VibeHub-Setup.exe` | نصب‌کنندهٔ NSIS ویندوز؛ امضای ناشر (Authenticode) ندارد |
| `latest.json`، `VibeHub_*_x64-setup.nsis.zip` و فایل‌های `.sig` | metadata و artifactهای امضاشدهٔ updater |
| `checksums-sha256.txt` | هش SHA-256 فایل‌های عمومی Release |
| `VibeHub-*-source.zip` | snapshot سورس همین tag |
| `VibeHub-SBOM.cdx.json` | فهرست اجزای نرم‌افزار به قالب CycloneDX |
| `LICENSE`، `THIRD_PARTY_LICENSES.md` | مجوز پروژه و noticeهای وابستگی‌های ثالث |

پیش از اجرا، SHA-256 نصب‌کننده را با `checksums-sha256.txt` بسنجید. به‌روزرسانی دستی است: **تنظیمات ← به‌روزرسانی‌ها ← بررسی کن**. بستهٔ updater امضا شده و VibeHub آن را با کلید عمومی تعبیه‌شده می‌سنجد.
