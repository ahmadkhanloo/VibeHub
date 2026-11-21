## VibeHub {{VERSION}} for Windows x64

> Download `VibeHub-Setup.exe` from this Release. The [acceptance matrix](https://github.com/ahmadkhanloo/VibeHub/blob/{{TAG}}/docs/validation/VibeHub_Release_Acceptance_Matrix.md) is the source for what has actually been verified.

VibeHub is a free, open-source desktop workspace for AI coding tools. It does not host models or provide a proxy service. Clean Windows 10 and 11 installation, upgrade and removal acceptance remain open unless the matrix records a passing run for the exact published build.

| File | Purpose |
|---|---|
| `VibeHub-Setup.exe` | Windows NSIS installer; it does not carry a Windows publisher (Authenticode) signature |
| `latest.json`, `VibeHub_*_x64-setup.nsis.zip`, and `.sig` files | Signed Tauri updater metadata and artifacts |
| `checksums-sha256.txt`, `VibeHub-SBOM.cdx.json`, `LICENSE`, and `THIRD_PARTY_LICENSES.md` | Download checksums, component inventory, and license notices |

Updates are manual: open **Settings → Updates → Check now**. The updater archive is signed and VibeHub verifies it against its embedded public key.

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
| `checksums-sha256.txt`، `VibeHub-SBOM.cdx.json`، `LICENSE` و `THIRD_PARTY_LICENSES.md` | هش فایل‌ها، فهرست اجزا و مجوزها |

به‌روزرسانی دستی است: **تنظیمات ← به‌روزرسانی‌ها ← بررسی کن**. بستهٔ updater امضا شده و VibeHub آن را با کلید عمومی تعبیه‌شده می‌سنجد.
