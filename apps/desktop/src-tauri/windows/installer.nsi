Unicode true
; VibeHub custom mode/component selection, based on Tauri CLI 2.12.4.
ManifestDPIAware true
; Add in `dpiAwareness` `PerMonitorV2` to manifest for Windows 10 1607+ (note this should not affect lower versions since they should be able to ignore this and pick up `dpiAware` `true` set by `ManifestDPIAware true`)
; Currently undocumented on NSIS's website but is in the Docs folder of source tree, see
; https://github.com/kichik/nsis/blob/5fc0b87b819a9eec006df4967d08e522ddd651c9/Docs/src/attributes.but#L286-L300
; https://github.com/tauri-apps/tauri/pull/10106
ManifestDPIAwareness PerMonitorV2

!if "{{compression}}" == "none"
  SetCompress off
!else
  ; Set the compression algorithm. We default to LZMA.
  SetCompressor /SOLID "{{compression}}"
!endif

; Keep above !include to stay ahead of any plugin command
; see https://github.com/tauri-apps/tauri/pull/15422#discussion_r3289239624
{{#if signed_plugins_path}}
!addplugindir "{{signed_plugins_path}}"
{{/if}}

!include MUI2.nsh
!include nsDialogs.nsh
!include FileFunc.nsh
!include x64.nsh
!include WordFunc.nsh
!include "utils.nsh"
!include "FileAssociation.nsh"
!include "Win\COM.nsh"
!include "Win\Propkey.nsh"
!include "Win\RestartManager.nsh"
!include "StrFunc.nsh"
${StrCase}
${StrLoc}

{{#if installer_hooks}}
!include "{{installer_hooks}}"
{{/if}}

!define WEBVIEW2APPGUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

!define MANUFACTURER "{{manufacturer}}"
!define PRODUCTNAME "{{product_name}}"
!define VERSION "{{version}}"
!define VERSIONWITHBUILD "{{version_with_build}}"
!define HOMEPAGE "{{homepage}}"
!define INSTALLMODE "{{install_mode}}"
!define LICENSE "{{license}}"
!define INSTALLERICON "{{installer_icon}}"
!define SIDEBARIMAGE "{{sidebar_image}}"
!define HEADERIMAGE "{{header_image}}"
!define UNINSTALLERICON "{{uninstaller_icon}}"
!define UNINSTALLERHEADERIMAGE "{{uninstaller_header_image}}"
!define MAINBINARYNAME "{{main_binary_name}}"
!define MAINBINARYSRCPATH "{{main_binary_path}}"
!define BUNDLEID "{{bundle_id}}"
!define COPYRIGHT "{{copyright}}"
!define OUTFILE "{{out_file}}"
!define ARCH "{{arch}}"
!define ADDITIONALPLUGINSPATH "{{additional_plugins_path}}"
!define ALLOWDOWNGRADES "{{allow_downgrades}}"
!define DISPLAYLANGUAGESELECTOR "{{display_language_selector}}"
!define INSTALLWEBVIEW2MODE "{{install_webview2_mode}}"
!define WEBVIEW2INSTALLERARGS "{{webview2_installer_args}}"
!define WEBVIEW2BOOTSTRAPPERPATH "{{webview2_bootstrapper_path}}"
!define WEBVIEW2INSTALLERPATH "{{webview2_installer_path}}"
!define MINIMUMWEBVIEW2VERSION "{{minimum_webview2_version}}"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
!define INSTALL_STATE_KEY "Software\ahmadkhanloo\VibeHub\Install"
!define MANUKEY "Software\${MANUFACTURER}"
!define MANUPRODUCTKEY "${MANUKEY}\${PRODUCTNAME}"
!define UNINSTALLERSIGNCOMMAND "{{uninstaller_sign_cmd}}"
!define ESTIMATEDSIZE "{{estimated_size}}"
!define STARTMENUFOLDER "{{start_menu_folder}}"

Var PassiveMode
Var UpdateMode
Var NoShortcutMode
Var WixMode
Var OldMainBinaryName
Var InstallMode
Var SelectedComponents
Var PreviousInstallMode
Var PreviousComponents
Var LegacyAgentRTL
Var LegacyInstallDir
Var LegacyComponents
Var LegacySelectionSeeded
Var ModeReplacement
Var ModeDialog
Var ModeFullRadio
Var ModeRtlRadio
Var ModeFullDetail
Var ModeRtlDetail
Var ModeZCode
Var ModeQoder
Var ModeAntigravity
Var ModeDeepSeek
Var ModeCountLabel

Name "${PRODUCTNAME}"
BrandingText "${COPYRIGHT}"
OutFile "${OUTFILE}"

; We don't actually use this value as default install path,
; it's just for nsis to append the product name folder in the directory selector
; https://nsis.sourceforge.io/Reference/InstallDir
!define PLACEHOLDER_INSTALL_DIR "placeholder\${PRODUCTNAME}"
InstallDir "${PLACEHOLDER_INSTALL_DIR}"

VIProductVersion "${VERSIONWITHBUILD}"
VIAddVersionKey "ProductName" "${PRODUCTNAME}"
VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
VIAddVersionKey "LegalCopyright" "${COPYRIGHT}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"

# additional plugins
!addplugindir "${ADDITIONALPLUGINSPATH}"

; Uninstaller signing command
!if "${UNINSTALLERSIGNCOMMAND}" != ""
  !uninstfinalize '${UNINSTALLERSIGNCOMMAND}'
!endif

; Handle install mode, `perUser`, `perMachine` or `both`
!if "${INSTALLMODE}" == "perMachine"
  RequestExecutionLevel admin
!endif

!if "${INSTALLMODE}" == "currentUser"
  RequestExecutionLevel user
!endif

!if "${INSTALLMODE}" == "both"
  !define MULTIUSER_MUI
  !define MULTIUSER_INSTALLMODE_INSTDIR "${PRODUCTNAME}"
  !define MULTIUSER_INSTALLMODE_COMMANDLINE
  !if "${ARCH}" == "x64"
    !define MULTIUSER_USE_PROGRAMFILES64
  !else if "${ARCH}" == "arm64"
    !define MULTIUSER_USE_PROGRAMFILES64
  !endif
  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_KEY "${UNINSTKEY}"
  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_VALUENAME "CurrentUser"
  !define MULTIUSER_INSTALLMODEPAGE_SHOWUSERNAME
  !define MULTIUSER_INSTALLMODE_FUNCTION RestorePreviousInstallLocation
  !define MULTIUSER_EXECUTIONLEVEL Highest
  !include MultiUser.nsh
!endif

; Installer icon
!if "${INSTALLERICON}" != ""
  !define MUI_ICON "${INSTALLERICON}"
!endif

; Installer sidebar image
!if "${SIDEBARIMAGE}" != ""
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${SIDEBARIMAGE}"
!endif

; Enable header images for installer and uninstaller pages when either image is configured.
!if "${HEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE
!else if "${UNINSTALLERHEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE
!endif

; Installer header image
!if "${HEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE_BITMAP "${HEADERIMAGE}"
!endif

; Uninstaller header image
!if "${UNINSTALLERHEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE_UNBITMAP "${UNINSTALLERHEADERIMAGE}"
!endif

; Uninstaller icon
!if "${UNINSTALLERICON}" != ""
  !define MUI_UNICON "${UNINSTALLERICON}"
!endif

; Define registry key to store installer language
!define MUI_LANGDLL_REGISTRY_ROOT "HKCU"
!define MUI_LANGDLL_REGISTRY_KEY "${MANUPRODUCTKEY}"
!define MUI_LANGDLL_REGISTRY_VALUENAME "Installer Language"

; Installer pages, must be ordered as they appear
; 1. Welcome Page
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!insertmacro MUI_PAGE_WELCOME

; 2. License Page (if defined)
!if "${LICENSE}" != ""
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !insertmacro MUI_PAGE_LICENSE "${LICENSE}"
!endif

; One bilingual mode page controls the app and the optional standalone RTL sections.
Page custom PageSetupChoice LeaveSetupChoice

; 3. Install mode (if it is set to `both`)
!if "${INSTALLMODE}" == "both"
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !insertmacro MULTIUSER_PAGE_INSTALLMODE
!endif

; 4. Custom page to ask user if he wants to reinstall/uninstall
;    only if a previous installation was detected
Var ReinstallPageCheck
Page custom PageReinstall PageLeaveReinstall

; Find a previous WiX installation and set $R6 to its uninstall registry key, or to "" if none.
;
; A WiX installer stores the installation info in registry
; using a UUID and so we have to loop through all keys under
; `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
; and check if `DisplayName` and `Publisher` keys match ${PRODUCTNAME} and ${MANUFACTURER}
;
; This has a potential issue that there maybe another installation that matches
; our ${PRODUCTNAME} and ${MANUFACTURER} but wasn't installed by our WiX installer,
; however, this should be fine since the user will have to confirm the uninstallation
; and they can chose to abort it if doesn't make sense.
Function FindWixInstall
  StrCpy $R6 ""
  StrCpy $0 0
  wix_loop:
    EnumRegKey $1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $0
    StrCmp $1 "" wix_loop_done ; Exit loop if there is no more keys to loop on
    IntOp $0 $0 + 1
    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"
    ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1" "Publisher"
    StrCmp "$R0$R1" "${PRODUCTNAME}${MANUFACTURER}" 0 wix_loop
    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
    ${StrCase} $R1 $R0 "L"
    ${StrLoc} $R0 $R1 "msiexec" ">"
    StrCmp $R0 0 0 wix_loop_done
    StrCpy $R6 "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1"
  wix_loop_done:
FunctionEnd

Function PageReinstall
  ; The signed updater already owns the replacement flow; do not show maintenance UI.
  ${If} $UpdateMode = 1
    Abort
  ${EndIf}
  ; Uninstall previous WiX installation if exists.
  Call FindWixInstall
  ${If} $R6 != ""
    StrCpy $WixMode 1
    Goto compare_version
  ${EndIf}

  ; Check if there is an existing installation, if not, abort the reinstall page
  ReadRegStr $R0 SHCTX "${UNINSTKEY}" ""
  ReadRegStr $R1 SHCTX "${UNINSTKEY}" "UninstallString"
  ${IfThen} "$R0$R1" == "" ${|} Abort ${|}

  Call DetectModeReplacement
  ${If} $ModeReplacement = 1
    !insertmacro MUI_HEADER_TEXT "$(VibeHubReplaceTitle)" ""
    ${If} $PassiveMode = 1
      Call PageLeaveReinstall
    ${Else}
      nsDialogs::Create 1018
      Pop $R4
      ${If} $R4 == error
        Abort
      ${EndIf}
      ${IfThen} $(^RTL) = 1 ${|} nsDialogs::SetRTL $(^RTL) ${|}
      ${NSD_CreateLabel} 0 0 100% 90u "$(VibeHubReplaceBody)"
      Pop $R0
      nsDialogs::Show
    ${EndIf}
    Return
  ${EndIf}

  ; Compare this installar version with the existing installation
  ; and modify the messages presented to the user accordingly
  compare_version:
  StrCpy $R4 "$(older)"
  ${If} $WixMode = 1
    ReadRegStr $R0 HKLM "$R6" "DisplayVersion"
  ${Else}
    ReadRegStr $R0 SHCTX "${UNINSTKEY}" "DisplayVersion"
  ${EndIf}
  ${IfThen} $R0 == "" ${|} StrCpy $R4 "$(unknown)" ${|}

  nsis_tauri_utils::SemverCompare "${VERSION}" $R0
  Pop $R0

  ; Read the install choice header through $R5 so a custom language file that only
  ; defines the misspelled `choowHowToInstall` still shows its own text
  ; TODO: remove the `choowHowToInstall` fallback in a future major version
  StrCpy $R5 "$(chooseHowToInstall)"
  ${IfThen} $R5 == "" ${|} StrCpy $R5 "$(choowHowToInstall)" ${|}

  ; Reinstalling the same version
  ${If} $R0 = 0
    StrCpy $R1 "$(alreadyInstalledLong)"
    StrCpy $R2 "$(addOrReinstall)"
    StrCpy $R3 "$(uninstallApp)"
    !insertmacro MUI_HEADER_TEXT "$(alreadyInstalled)" "$(chooseMaintenanceOption)"
  ; Upgrading
  ${ElseIf} $R0 = 1
    StrCpy $R1 "$(olderOrUnknownVersionInstalled)"
    StrCpy $R2 "$(uninstallBeforeInstalling)"
    StrCpy $R3 "$(dontUninstall)"
    !insertmacro MUI_HEADER_TEXT "$(alreadyInstalled)" "$R5"
  ; Downgrading
  ${ElseIf} $R0 = -1
    StrCpy $R1 "$(newerVersionInstalled)"
    StrCpy $R2 "$(uninstallBeforeInstalling)"
    !if "${ALLOWDOWNGRADES}" == "true"
      StrCpy $R3 "$(dontUninstall)"
    !else
      StrCpy $R3 "$(dontUninstallDowngrade)"
    !endif
    !insertmacro MUI_HEADER_TEXT "$(alreadyInstalled)" "$R5"
  ${Else}
    Abort
  ${EndIf}

  ; Skip showing the page if passive
  ;
  ; Note that we don't call this earlier at the beginning
  ; of this function because we need to populate some variables
  ; related to current installed version if detected and whether
  ; we are downgrading or not.
  ${If} $PassiveMode = 1
    Call PageLeaveReinstall
  ${Else}
    nsDialogs::Create 1018
    Pop $R4
    ${IfThen} $(^RTL) = 1 ${|} nsDialogs::SetRTL $(^RTL) ${|}

    ${NSD_CreateLabel} 0 0 100% 24u $R1
    Pop $R1

    ${NSD_CreateRadioButton} 30u 50u -30u 8u $R2
    Pop $R2
    ${NSD_OnClick} $R2 PageReinstallUpdateSelection

    ${NSD_CreateRadioButton} 30u 70u -30u 8u $R3
    Pop $R3
    ; Disable this radio button if downgrading and downgrades are disabled
    !if "${ALLOWDOWNGRADES}" == "false"
      ${IfThen} $R0 = -1 ${|} EnableWindow $R3 0 ${|}
    !endif
    ${NSD_OnClick} $R3 PageReinstallUpdateSelection

    ; Check the first radio button if this the first time
    ; we enter this page or if the second button wasn't
    ; selected the last time we were on this page
    ${If} $ReinstallPageCheck <> 2
      SendMessage $R2 ${BM_SETCHECK} ${BST_CHECKED} 0
    ${Else}
      SendMessage $R3 ${BM_SETCHECK} ${BST_CHECKED} 0
    ${EndIf}

    ${NSD_SetFocus} $R2
    nsDialogs::Show
  ${EndIf}
FunctionEnd
Function PageReinstallUpdateSelection
  ${NSD_GetState} $R2 $R1
  ${If} $R1 == ${BST_CHECKED}
    StrCpy $ReinstallPageCheck 1
  ${Else}
    StrCpy $ReinstallPageCheck 2
  ${EndIf}
FunctionEnd
Function DetectModeReplacement
  StrCpy $ModeReplacement 0
  ${If} $UpdateMode = 1
    Return
  ${EndIf}
  ${If} $WixMode = 1
    ${If} $InstallMode == "rtl"
      StrCpy $ModeReplacement 1
    ${EndIf}
    Return
  ${EndIf}
  ${If} $PreviousInstallMode != ""
    ${If} $PreviousInstallMode != $InstallMode
      StrCpy $ModeReplacement 1
      Return
    ${EndIf}
    ${If} $InstallMode == "rtl"
    ${AndIf} $PreviousComponents != $SelectedComponents
      StrCpy $ModeReplacement 1
    ${EndIf}
    Return
  ${EndIf}
  ${If} $InstallMode == "rtl"
    ReadRegStr $R5 SHCTX "${UNINSTKEY}" "UninstallString"
    ${If} $R5 != ""
      StrCpy $ModeReplacement 1
    ${EndIf}
  ${EndIf}
FunctionEnd
Function PageLeaveReinstall
  ; If migrating from Wix, always uninstall
  ${If} $WixMode = 1
    Goto reinst_uninstall
  ${EndIf}

  ; In update mode, always proceeds without uninstalling
  ${If} $UpdateMode = 1
    Goto reinst_done
  ${EndIf}

  ${If} $ModeReplacement = 1
    Goto reinst_uninstall
  ${EndIf}

  ; Passive installs keep the existing files unless the selected mode requires replacement.
  ${If} $PassiveMode = 1
    Goto reinst_done
  ${EndIf}

  ${NSD_GetState} $R2 $R1

  ; Older VibeHub installs have no component-state record. Moving one to RTL-only
  ; must remove its owned desktop files so the new mode cannot leave the hub behind.
  ${If} $InstallMode == "rtl"
  ${AndIf} $PreviousInstallMode == ""
    ReadRegStr $R5 SHCTX "${UNINSTKEY}" "UninstallString"
    ${If} $R5 != ""
      Goto reinst_uninstall
    ${EndIf}
  ${EndIf}

  ; Mode changes and explicit component removals require a clean owned uninstall.
  ${If} $PreviousInstallMode != ""
  ${AndIf} $PreviousInstallMode != $InstallMode
    Goto reinst_uninstall
  ${EndIf}
  ${If} $InstallMode == "rtl"
  ${AndIf} $PreviousComponents != $SelectedComponents
    Goto reinst_uninstall
  ${EndIf}

  ; $R0 holds whether same(0)/upgrading(1)/downgrading(-1) version
  ; $R1 holds the radio buttons state:
  ;   1 => first choice was selected
  ;   0 => second choice was selected
  ${If} $R0 = 0 ; Same version, proceed
    ${If} $R1 = 1              ; User chose to add/reinstall
      Goto reinst_done
    ${Else}                    ; User chose to uninstall
      Goto reinst_uninstall
    ${EndIf}
  ${ElseIf} $R0 = 1 ; Upgrading
    ${If} $R1 = 1              ; User chose to uninstall
      Goto reinst_uninstall
    ${Else}
      Goto reinst_done         ; User chose NOT to uninstall
    ${EndIf}
  ${ElseIf} $R0 = -1 ; Downgrading
    ${If} $R1 = 1              ; User chose to uninstall
      Goto reinst_uninstall
    ${Else}
      Goto reinst_done         ; User chose NOT to uninstall
    ${EndIf}
  ${EndIf}

  reinst_uninstall:
    HideWindow
    ClearErrors

    ${If} $WixMode = 1
      ReadRegStr $R1 HKLM "$R6" "UninstallString"
      ExecWait '$R1' $0
    ${Else}
      ReadRegStr $4 SHCTX "${MANUPRODUCTKEY}" ""
      ReadRegStr $R1 SHCTX "${UNINSTKEY}" "UninstallString"
      ${IfThen} $UpdateMode = 1 ${|} StrCpy $R1 "$R1 /UPDATE" ${|} ; append /UPDATE
      ${IfThen} $PassiveMode = 1 ${|} StrCpy $R1 "$R1 /P" ${|} ; append /P
      StrCpy $R1 "$R1 _?=$4" ; append uninstall directory
      ExecWait '$R1' $0
    ${EndIf}

    BringToFront

    ${IfThen} ${Errors} ${|} StrCpy $0 2 ${|} ; ExecWait failed, set fake exit code

    ${If} $0 <> 0
    ${OrIf} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
      ; User cancelled wix uninstaller? return to select un/reinstall page
      ${If} $WixMode = 1
      ${AndIf} $0 = 1602
        Abort
      ${EndIf}

      ; User cancelled NSIS uninstaller? return to select un/reinstall page
      ${If} $0 = 1
        Abort
      ${EndIf}

      ; Other errors? show generic error message and return to select un/reinstall page
      MessageBox MB_ICONEXCLAMATION "$(unableToUninstall)"
      Abort
    ${EndIf}

    ; The NSIS uninstaller was run in place (`_?=`), so it cannot delete itself
    ; and the install directory, clean them up here once the uninstall succeeded
    ; https://nsis.sourceforge.io/Docs/Chapter3.html#:~:text=path%20contains%20spaces.-,3.2.3%20Examples,-installer.exe%20/NCRC
    ${If} $WixMode = 0
    ${AndIf} $4 != ""
      Delete "$4\uninstall.exe"
      RMDir "$4"
    ${EndIf}
  reinst_done:
FunctionEnd

; 5. Choose install directory page
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!insertmacro MUI_PAGE_DIRECTORY

; 6. Start menu shortcut page
Var AppStartMenuFolder
!if "${STARTMENUFOLDER}" != ""
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipStartMenuPage
  !define MUI_STARTMENUPAGE_DEFAULTFOLDER "${STARTMENUFOLDER}"
!else
  !define MUI_PAGE_CUSTOMFUNCTION_PRE Skip
!endif
!insertmacro MUI_PAGE_STARTMENU Application $AppStartMenuFolder

; 7. Installation page
!insertmacro MUI_PAGE_INSTFILES

; 8. Finish page
;
; Don't auto jump to finish page after installation page,
; because the installation page has useful info that can be used debug any issues with the installer.
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
; 1. Confirm uninstall page
Var DeleteAppDataCheckbox
Var DeleteAppDataCheckboxState
!define /ifndef WS_EX_LAYOUTRTL         0x00400000
!define MUI_PAGE_CUSTOMFUNCTION_SHOW un.ConfirmShow
Function un.ConfirmShow ; Add add a `Delete app data` check box
  ; $1 inner dialog HWND
  ; $2 window DPI
  ; $3 style
  ; $4 x
  ; $5 y
  ; $6 width
  ; $7 height
  FindWindow $1 "#32770" "" $HWNDPARENT ; Find inner dialog
  System::Call "user32::GetDpiForWindow(p r1) i .r2"
  ${If} $(^RTL) = 1
    StrCpy $3 "${__NSD_CheckBox_EXSTYLE} | ${WS_EX_LAYOUTRTL}"
    IntOp $4 50 * $2
  ${Else}
    StrCpy $3 "${__NSD_CheckBox_EXSTYLE}"
    IntOp $4 0 * $2
  ${EndIf}
  IntOp $5 100 * $2
  IntOp $6 400 * $2
  IntOp $7 25 * $2
  IntOp $4 $4 / 96
  IntOp $5 $5 / 96
  IntOp $6 $6 / 96
  IntOp $7 $7 / 96
  System::Call 'user32::CreateWindowEx(i r3, w "${__NSD_CheckBox_CLASS}", w "$(deleteAppData)", i ${__NSD_CheckBox_STYLE}, i r4, i r5, i r6, i r7, p r1, i0, i0, i0) i .s'
  Pop $DeleteAppDataCheckbox
  SendMessage $HWNDPARENT ${WM_GETFONT} 0 0 $1
  SendMessage $DeleteAppDataCheckbox ${WM_SETFONT} $1 1
FunctionEnd
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE un.ConfirmLeave
Function un.ConfirmLeave
  SendMessage $DeleteAppDataCheckbox ${BM_GETCHECK} 0 0 $DeleteAppDataCheckboxState
FunctionEnd
!define MUI_PAGE_CUSTOMFUNCTION_PRE un.SkipIfPassive
!insertmacro MUI_UNPAGE_CONFIRM

; 2. Uninstalling Page
!insertmacro MUI_UNPAGE_INSTFILES

;Languages
; PageReinstall reads the misspelled `choowHowToInstall` as a fallback, and makensis warns
; about a language string that is read but never set, so default it to an empty string for
; every language. This runs before the language files are included, so a custom language
; file that only defines the old spelling overrides the default and the fallback shows its
; text. `0` as the language id means the language inserted right above.
; TODO: remove the `choowHowToInstall` fallback in a future major version
{{#each languages}}
!insertmacro MUI_LANGUAGE "{{this}}"
LangString choowHowToInstall 0 ""
{{/each}}
LangString VibeHubModePrompt ${LANG_ENGLISH} "Choose a setup. Then select RTL tools below."
LangString VibeHubModePrompt ${LANG_FARSI} "روش نصب را انتخاب کن و ابزارهای RTL را پایین تیک بزن."
LangString VibeHubModeFull ${LANG_ENGLISH} "Full install"
LangString VibeHubModeFull ${LANG_FARSI} "نصب کامل"
LangString VibeHubModeFullDetail ${LANG_ENGLISH} "VibeHub + all 4 RTL tools (recommended)"
LangString VibeHubModeFullDetail ${LANG_FARSI} "VibeHub و هر ۴ ابزار RTL (پیشنهادی)"
LangString VibeHubModeRtl ${LANG_ENGLISH} "RTL tools only"
LangString VibeHubModeRtl ${LANG_FARSI} "فقط ابزارهای RTL"
LangString VibeHubModeRtlDetail ${LANG_ENGLISH} "Choose 1–4 tools; no VibeHub app"
LangString VibeHubModeRtlDetail ${LANG_FARSI} "۱ تا ۴ ابزار؛ بدون نصب خود VibeHub"
LangString VibeHubRtlSectionTitle ${LANG_ENGLISH} "Choose RTL tools (4 available)"
LangString VibeHubRtlSectionTitle ${LANG_FARSI} "انتخاب ابزارهای RTL (۴ مورد)"
LangString VibeHubFullCount ${LANG_ENGLISH} "All 4 RTL tools are included in Full install."
LangString VibeHubFullCount ${LANG_FARSI} "در نصب کامل هر ۴ ابزار RTL نصب می‌شوند."
LangString VibeHubCountSelected ${LANG_ENGLISH} "Selected:"
LangString VibeHubCountSelected ${LANG_FARSI} "انتخاب:"
LangString VibeHubCountTotal ${LANG_ENGLISH} "of 4"
LangString VibeHubCountTotal ${LANG_FARSI} "از ۴"
LangString VibeHubZCode ${LANG_ENGLISH} "ZCode RTL"
LangString VibeHubZCode ${LANG_FARSI} "RTL زِدکد"
LangString VibeHubQoder ${LANG_ENGLISH} "Qoder RTL"
LangString VibeHubQoder ${LANG_FARSI} "RTL کودر"
LangString VibeHubDeepSeek ${LANG_ENGLISH} "DeepSeek Harness RTL"
LangString VibeHubDeepSeek ${LANG_FARSI} "RTL دیپ‌سیک هارنس"
LangString VibeHubAntigravity ${LANG_ENGLISH} "Antigravity chat RTL (experimental)"
LangString VibeHubAntigravity ${LANG_FARSI} "RTL چت Antigravity (آزمایشی)"
LangString VibeHubNoRtl ${LANG_ENGLISH} "Select at least one RTL launcher."
LangString VibeHubNoRtl ${LANG_FARSI} "حداقل یک میانبر RTL را انتخاب کنید."
LangString VibeHubLegacyNotice ${LANG_ENGLISH} "AgentRTL found. Previous RTL choices are selected below."
LangString VibeHubLegacyNotice ${LANG_FARSI} "AgentRTL پیدا شد؛ انتخاب‌های قبلی پایین صفحه مشخص شده‌اند."
LangString VibeHubLegacyComponents ${LANG_ENGLISH} "Previously selected tools:"
LangString VibeHubLegacyComponents ${LANG_FARSI} "ابزارهای انتخاب‌شدهٔ قبلی:"
LangString VibeHubReplaceTitle ${LANG_ENGLISH} "Replace the installed VibeHub components"
LangString VibeHubReplaceTitle ${LANG_FARSI} "جایگزینی مؤلفه‌های نصب‌شدهٔ VibeHub"
LangString VibeHubReplaceBody ${LANG_ENGLISH} "Your selected mode or RTL tools change the installed files. Setup will remove only files, shortcuts, and injectors owned by this VibeHub installation, then install the selected components. Personal settings and saved tool paths are kept unless you check Delete app data."
LangString VibeHubReplaceBody ${LANG_FARSI} "حالت نصب یا ابزارهای RTL انتخاب‌شده فایل‌های نصب را تغییر می‌دهند. Setup فقط فایل‌ها، میانبرها و injectorهای متعلق به همین نصب VibeHub را حذف و مؤلفه‌های انتخاب‌شده را نصب می‌کند. تنظیمات شخصی و مسیر ابزارها حفظ می‌شوند، مگر اینکه گزینهٔ حذف داده‌های برنامه را انتخاب کنید."
!insertmacro MUI_RESERVEFILE_LANGDLL
{{#each language_files}}
  !include "{{this}}"
{{/each}}

Function .onInit
  ${GetOptions} $CMDLINE "/P" $PassiveMode
  ${IfNot} ${Errors}
    StrCpy $PassiveMode 1
  ${EndIf}

  ${GetOptions} $CMDLINE "/NS" $NoShortcutMode
  ${IfNot} ${Errors}
    StrCpy $NoShortcutMode 1
  ${EndIf}

  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}

  ReadRegStr $InstallMode HKCU "${INSTALL_STATE_KEY}" "mode"
  StrCpy $PreviousInstallMode $InstallMode
  ReadRegStr $SelectedComponents HKCU "${INSTALL_STATE_KEY}" "rtlComponents"
  StrCpy $PreviousComponents $SelectedComponents
  ${If} $InstallMode == ""
    StrCpy $InstallMode "full"
  ${EndIf}
  ${If} $SelectedComponents == ""
    StrCpy $SelectedComponents "zcode,qoder,deepseek-harness,antigravity"
  ${EndIf}
  ${If} $UpdateMode = 1
    StrCpy $InstallMode "full"
  ${EndIf}
  ReadRegStr $LegacyAgentRTL HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{A7E3F1B2-5C4D-4E8F-9A0B-1C2D3E4F5A6B}_is1" "UninstallString"
  ReadRegStr $LegacyInstallDir HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{A7E3F1B2-5C4D-4E8F-9A0B-1C2D3E4F5A6B}_is1" "InstallLocation"
  ReadRegStr $LegacyComponents HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{A7E3F1B2-5C4D-4E8F-9A0B-1C2D3E4F5A6B}_is1" "Inno Setup: Selected Components"
  StrCpy $LegacySelectionSeeded 0
  ${If} $LegacyAgentRTL != ""
  ${AndIf} $LegacyInstallDir == ""
    StrCpy $LegacyInstallDir "$LOCALAPPDATA\AgentRTL"
  ${EndIf}
  ${If} $LegacyAgentRTL != ""
  ${AndIf} $LegacyComponents == ""
    StrCpy $LegacyComponents "zcode,qoder,deepseek"
  ${EndIf}
  Call InitSelection

  !if "${DISPLAYLANGUAGESELECTOR}" == "true"
    !insertmacro MUI_LANGDLL_DISPLAY
  !endif

  !insertmacro SetContext

  ${If} $INSTDIR == "${PLACEHOLDER_INSTALL_DIR}"
    ; Set default install location
    !if "${INSTALLMODE}" == "perMachine"
      ${If} ${RunningX64}
        !if "${ARCH}" == "x64"
          StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCTNAME}"
        !else if "${ARCH}" == "arm64"
          StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCTNAME}"
        !else
          StrCpy $INSTDIR "$PROGRAMFILES\${PRODUCTNAME}"
        !endif
      ${Else}
        StrCpy $INSTDIR "$PROGRAMFILES\${PRODUCTNAME}"
      ${EndIf}
    !else if "${INSTALLMODE}" == "currentUser"
      StrCpy $INSTDIR "$LOCALAPPDATA\${PRODUCTNAME}"
    !endif

    Call RestorePreviousInstallLocation
  ${EndIf}


  !if "${INSTALLMODE}" == "both"
    !insertmacro MULTIUSER_INIT
  !endif

  ; Abort downgrades if they are disabled, in the modes that skip the reinstall page choice:
  ; silent, passive and update
  !if "${ALLOWDOWNGRADES}" == "false"
  ${If} ${Silent}
  ${OrIf} $PassiveMode = 1
  ${OrIf} $UpdateMode = 1
    ; Compare with the same installation the reinstall page would: a WiX one first
    Call FindWixInstall
    ${If} $R6 != ""
      ReadRegStr $R0 HKLM "$R6" "DisplayVersion"
    ${Else}
      ReadRegStr $R0 SHCTX "${UNINSTKEY}" "DisplayVersion"
    ${EndIf}
    nsis_tauri_utils::SemverCompare "${VERSION}" $R0
    Pop $R0
    ; If downgrading
    ${If} $R0 = -1
      ${If} ${Silent}
        System::Call 'kernel32::AttachConsole(i -1)i.r0'
        ${If} $0 <> 0
          System::Call 'kernel32::GetStdHandle(i -11)i.r0'
          System::call 'kernel32::SetConsoleTextAttribute(i r0, i 0x0004)' ; set red color
          FileWrite $0 "$(silentDowngrades)"
        ${EndIf}
      ${Else}
        MessageBox MB_ICONSTOP "$(silentDowngrades)"
      ${EndIf}
      Abort
    ${EndIf}
  ${EndIf}
  !endif
FunctionEnd

Section WebView2
  ${If} $InstallMode == "full"
  ; Check if Webview2 is already installed and skip this section
  ${If} ${RunningX64}
    ReadRegStr $4 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${Else}
    ReadRegStr $4 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${EndIf}
  ${If} $4 == ""
    ReadRegStr $4 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${EndIf}

  ${If} $4 == ""
    ; Webview2 installation
    ;
    ; Skip if updating
    ${If} $UpdateMode <> 1
      !if "${INSTALLWEBVIEW2MODE}" == "downloadBootstrapper"
        Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        DetailPrint "$(webview2Downloading)"
        NSISdl::download "https://go.microsoft.com/fwlink/p/?LinkId=2124703" "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        Pop $0
        ${If} $0 == "success"
          DetailPrint "$(webview2DownloadSuccess)"
        ${Else}
          DetailPrint "$(webview2DownloadError)"
          Abort "$(webview2AbortError)"
        ${EndIf}
        StrCpy $6 "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        Goto install_webview2
      !endif

      !if "${INSTALLWEBVIEW2MODE}" == "embedBootstrapper"
        Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        File "/oname=$TEMP\MicrosoftEdgeWebview2Setup.exe" "${WEBVIEW2BOOTSTRAPPERPATH}"
        DetailPrint "$(installingWebview2)"
        StrCpy $6 "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        Goto install_webview2
      !endif

      !if "${INSTALLWEBVIEW2MODE}" == "offlineInstaller"
        Delete "$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe"
        File "/oname=$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe" "${WEBVIEW2INSTALLERPATH}"
        DetailPrint "$(installingWebview2)"
        StrCpy $6 "$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe"
        Goto install_webview2
      !endif

      Goto webview2_done

      install_webview2:
        DetailPrint "$(installingWebview2)"
        ; $6 holds the path to the webview2 installer
        ExecWait "$6 ${WEBVIEW2INSTALLERARGS} /install" $1
        ${If} $1 = 0
          DetailPrint "$(webview2InstallSuccess)"
        ${Else}
          DetailPrint "$(webview2InstallError)"
          Abort "$(webview2AbortError)"
        ${EndIf}
      webview2_done:
    ${EndIf}
  ${Else}
    !if "${MINIMUMWEBVIEW2VERSION}" != ""
      ${VersionCompare} "${MINIMUMWEBVIEW2VERSION}" "$4" $R0
      ${If} $R0 = 1
        update_webview:
          DetailPrint "$(installingWebview2)"
          ${If} ${RunningX64}
            ReadRegStr $R1 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate" "path"
          ${Else}
            ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\EdgeUpdate" "path"
          ${EndIf}
          ${If} $R1 == ""
            ReadRegStr $R1 HKCU "SOFTWARE\Microsoft\EdgeUpdate" "path"
          ${EndIf}
          ${If} $R1 != ""
            ; Chromium updater docs: https://source.chromium.org/chromium/chromium/src/+/main:docs/updater/user_manual.md
            ; Modified from "HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft EdgeWebView\ModifyPath"
            ExecWait `"$R1" /install appguid=${WEBVIEW2APPGUID}&needsadmin=true` $1
            ${If} $1 = 0
              DetailPrint "$(webview2InstallSuccess)"
            ${Else}
              MessageBox MB_ICONEXCLAMATION|MB_ABORTRETRYIGNORE "$(webview2InstallError)" IDIGNORE ignore IDRETRY update_webview
              Quit
              ignore:
            ${EndIf}
          ${EndIf}
      ${EndIf}
    !endif
  ${EndIf}
  ${EndIf}
SectionEnd

Section /o "VibeHub desktop" SEC_INSTALL
  SetOutPath $INSTDIR

  !ifmacrodef NSIS_HOOK_PREINSTALL
    !insertmacro NSIS_HOOK_PREINSTALL
  !endif

  !insertmacro CheckIfAppIsRunning "$INSTDIR\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"

  ; Copy main executable
  File "${MAINBINARYSRCPATH}"

  ; Copy resources
  {{#each resources_dirs}}
    CreateDirectory "$INSTDIR\\{{this}}"
  {{/each}}
  {{#each resources}}
    File /a "/oname={{this.[1]}}" "{{no-escape @key}}"
  {{/each}}

  ; Copy external binaries
  {{#each binaries}}
    File /a "/oname={{this}}" "{{no-escape @key}}"
  {{/each}}

  ; Create file associations
  {{#each file_associations as |association| ~}}
    {{#each association.ext as |ext| ~}}
       !insertmacro APP_ASSOCIATE "{{ext}}" "{{or association.name ext}}" "{{association-description association.description ext}}" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0" "Open with ${PRODUCTNAME}" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
    {{/each}}
  {{/each}}

  ; Register deep links
  {{#each deep_link_protocols as |protocol| ~}}
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}" "URL Protocol" ""
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}" "" "URL:${BUNDLEID} protocol"
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  {{/each}}

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Save $INSTDIR in registry for future installations
  WriteRegStr SHCTX "${MANUPRODUCTKEY}" "" $INSTDIR

  !if "${INSTALLMODE}" == "both"
    ; Save install mode to be selected by default for the next installation such as updating
    ; or when uninstalling
    WriteRegStr SHCTX "${UNINSTKEY}" $MultiUser.InstallMode 1
  !endif

  ; Remove old main binary if it doesn't match new main binary name
  ReadRegStr $OldMainBinaryName SHCTX "${UNINSTKEY}" "MainBinaryName"
  ${If} $OldMainBinaryName != ""
  ${AndIf} $OldMainBinaryName != "${MAINBINARYNAME}.exe"
    Delete "$INSTDIR\$OldMainBinaryName"
  ${EndIf}

  ; Save current MAINBINARYNAME for future updates
  WriteRegStr SHCTX "${UNINSTKEY}" "MainBinaryName" "${MAINBINARYNAME}.exe"

  ; Registry information for add/remove programs
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayIcon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\""
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr SHCTX "${UNINSTKEY}" "Publisher" "${MANUFACTURER}"
  WriteRegStr SHCTX "${UNINSTKEY}" "InstallLocation" "$\"$INSTDIR$\""
  WriteRegStr SHCTX "${UNINSTKEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegDWORD SHCTX "${UNINSTKEY}" "NoModify" "1"
  WriteRegDWORD SHCTX "${UNINSTKEY}" "NoRepair" "1"

  ${GetSize} "$INSTDIR" "/M=uninstall.exe /S=0K /G=0" $0 $1 $2
  IntOp $0 $0 + ${ESTIMATEDSIZE}
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD SHCTX "${UNINSTKEY}" "EstimatedSize" "$0"

  !if "${HOMEPAGE}" != ""
    WriteRegStr SHCTX "${UNINSTKEY}" "URLInfoAbout" "${HOMEPAGE}"
    WriteRegStr SHCTX "${UNINSTKEY}" "URLUpdateInfo" "${HOMEPAGE}"
    WriteRegStr SHCTX "${UNINSTKEY}" "HelpLink" "${HOMEPAGE}"
  !endif

  ; Create start menu shortcut
  !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
    Call CreateOrUpdateStartMenuShortcut
  !insertmacro MUI_STARTMENU_WRITE_END

  ; Create desktop shortcut for silent and passive installers
  ; because finish page will be skipped
  ${If} $PassiveMode = 1
  ${OrIf} ${Silent}
    Call CreateOrUpdateDesktopShortcut
  ${EndIf}

  !ifmacrodef NSIS_HOOK_POSTINSTALL
    !insertmacro NSIS_HOOK_POSTINSTALL
  !endif

  ; Auto close this page for passive mode
  ${If} $PassiveMode = 1
    SetAutoClose true
  ${EndIf}
SectionEnd

Section /o "RTL runtime" SEC_RUNTIME
  SetOutPath "$INSTDIR\runtime"
  File "${VIBEHUB_PAYLOAD_DIR}\node.exe"
  SetOutPath "$INSTDIR\apps"
  File "${VIBEHUB_PAYLOAD_DIR}\rtl-paths.ps1"
  File "${VIBEHUB_PAYLOAD_DIR}\rtl-direction.mjs"
  File "${VIBEHUB_PAYLOAD_DIR}\migrate-agentrtl-paths.ps1"
  SetOutPath "$INSTDIR\licenses"
  File "${VIBEHUB_PAYLOAD_DIR}\NODE-LICENSE.md"
  SetOutPath "$INSTDIR"
  File "${VIBEHUB_PAYLOAD_DIR}\cleanup.ps1"
  File "${VIBEHUB_PAYLOAD_DIR}\LICENSE"
  File "${VIBEHUB_PAYLOAD_DIR}\THIRD_PARTY_LICENSES.md"
SectionEnd

Section /o "ZCode RTL" SEC_ZCODE
  SetOutPath "$INSTDIR\apps\ZCode"
  File /r "${VIBEHUB_PAYLOAD_DIR}\ZCode\*"
SectionEnd

Section /o "Qoder RTL" SEC_QODER
  SetOutPath "$INSTDIR\apps\Qoder"
  File /r "${VIBEHUB_PAYLOAD_DIR}\Qoder\*"
SectionEnd

Section /o "Antigravity RTL" SEC_ANTIGRAVITY
  SetOutPath "$INSTDIR\apps\Antigravity"
  File /r "${VIBEHUB_PAYLOAD_DIR}\Antigravity\*"
SectionEnd

Section /o "DeepSeek Harness RTL" SEC_DEEPSEEK
  SetOutPath "$INSTDIR\apps\DeepSeekHarness"
  File /r "${VIBEHUB_PAYLOAD_DIR}\DeepSeekHarness\*"
SectionEnd

Section "-VibeHub installation state" SEC_INSTALL_STATE
  ${If} $InstallMode == "rtl"
    SetOutPath "$INSTDIR"
    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKCU "${MANUPRODUCTKEY}" "" "$INSTDIR"
    WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "VibeHub RTL Launchers"
    WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
    WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${MANUFACTURER}"
    WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" "1"
    WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" "1"
    Call CreateRtlShortcuts
  ${Else}
    StrCpy $SelectedComponents "zcode,qoder,deepseek-harness,antigravity"
    Call CreateRtlShortcuts
  ${EndIf}
  ${If} $LegacyAgentRTL != ""
    ${If} $InstallMode == "rtl"
      StrCpy $R6 "$INSTDIR\apps"
    ${Else}
      StrCpy $R6 "$INSTDIR\resources\apps"
    ${EndIf}
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$R6\migrate-agentrtl-paths.ps1" -LegacyInstallDir "$LegacyInstallDir"' $0
  ${EndIf}
  WriteRegStr HKCU "${INSTALL_STATE_KEY}" "schemaVersion" "1"
  WriteRegStr HKCU "${INSTALL_STATE_KEY}" "mode" "$InstallMode"
  WriteRegStr HKCU "${INSTALL_STATE_KEY}" "rtlComponents" "$SelectedComponents"
SectionEnd

Function InitSelection
  SectionSetFlags ${SEC_INSTALL} 0
  SectionSetFlags ${SEC_RUNTIME} 0
  SectionSetFlags ${SEC_ZCODE} 0
  SectionSetFlags ${SEC_QODER} 0
  SectionSetFlags ${SEC_DEEPSEEK} 0
  SectionSetFlags ${SEC_ANTIGRAVITY} 0
  ${If} $InstallMode == "full"
  ${OrIf} $UpdateMode = 1
    SectionSetFlags ${SEC_INSTALL} ${SF_SELECTED}
  ${Else}
    SectionSetFlags ${SEC_RUNTIME} ${SF_SELECTED}
    ${StrLoc} $R1 $SelectedComponents "zcode" ">"
    ${If} $R1 != "-1"
      SectionSetFlags ${SEC_ZCODE} ${SF_SELECTED}
    ${EndIf}
    ${StrLoc} $R1 $SelectedComponents "qoder" ">"
    ${If} $R1 != "-1"
      SectionSetFlags ${SEC_QODER} ${SF_SELECTED}
    ${EndIf}
    ${StrLoc} $R1 $SelectedComponents "deepseek-harness" ">"
    ${If} $R1 != "-1"
      SectionSetFlags ${SEC_DEEPSEEK} ${SF_SELECTED}
    ${EndIf}
    ${StrLoc} $R1 $SelectedComponents "antigravity" ">"
    ${If} $R1 != "-1"
      SectionSetFlags ${SEC_ANTIGRAVITY} ${SF_SELECTED}
    ${EndIf}
  ${EndIf}
FunctionEnd

Function PageSetupChoice
  ${If} $PassiveMode = 1
    Abort
  ${EndIf}
  ; Tauri's updater runs this same Setup in /UPDATE mode. Keep that path full-only.
  ${If} $UpdateMode = 1
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $ModeDialog
  ${If} $ModeDialog == error
    Abort
  ${EndIf}
  ${IfThen} $(^RTL) = 1 ${|} nsDialogs::SetRTL $(^RTL) ${|}
  ${If} $LegacyAgentRTL != ""
    ${NSD_CreateLabel} 0 0 100% 20u "$(VibeHubLegacyNotice)"
    Pop $0
  ${Else}
    ${NSD_CreateLabel} 0 0 100% 20u "$(VibeHubModePrompt)"
    Pop $0
  ${EndIf}
  ${NSD_CreateGroupBox} 0 20u 49% 44u ""
  Pop $0
  ${NSD_CreateGroupBox} 51% 20u 49% 44u ""
  Pop $0
  ${NSD_CreateFirstRadioButton} 9u 27u 38% 18u "$(VibeHubModeFull)"
  Pop $ModeFullRadio
  ${NSD_CreateAdditionalRadioButton} 54% 27u 39% 18u "$(VibeHubModeRtl)"
  Pop $ModeRtlRadio
  ${NSD_CreateLabel} 9u 44u 38% 18u "$(VibeHubModeFullDetail)"
  Pop $ModeFullDetail
  ${NSD_CreateLabel} 54% 44u 39% 18u "$(VibeHubModeRtlDetail)"
  Pop $ModeRtlDetail
  ${NSD_CreateGroupBox} 0 66u 100% 108u "$(VibeHubRtlSectionTitle)"
  Pop $0
  ${NSD_CreateCheckBox} 12u 81u 92% 15u "$(VibeHubZCode)"
  Pop $ModeZCode
  ${NSD_CreateCheckBox} 12u 97u 92% 15u "$(VibeHubQoder)"
  Pop $ModeQoder
  ${NSD_CreateCheckBox} 12u 113u 92% 15u "$(VibeHubDeepSeek)"
  Pop $ModeDeepSeek
  ${NSD_CreateCheckBox} 12u 129u 92% 15u "$(VibeHubAntigravity)"
  Pop $ModeAntigravity
  ${NSD_CreateLabel} 12u 149u 92% 18u ""
  Pop $ModeCountLabel
  ${If} $InstallMode == "rtl"
    ${NSD_Check} $ModeRtlRadio
    ${StrLoc} $R1 $SelectedComponents "zcode" ">"
    ${If} $R1 != "-1"
      ${NSD_Check} $ModeZCode
    ${EndIf}
    ${StrLoc} $R1 $SelectedComponents "qoder" ">"
    ${If} $R1 != "-1"
      ${NSD_Check} $ModeQoder
    ${EndIf}
    ${StrLoc} $R1 $SelectedComponents "deepseek-harness" ">"
    ${If} $R1 != "-1"
      ${NSD_Check} $ModeDeepSeek
    ${EndIf}
    ${StrLoc} $R1 $SelectedComponents "antigravity" ">"
    ${If} $R1 != "-1"
      ${NSD_Check} $ModeAntigravity
    ${EndIf}
  ${Else}
    ${NSD_Check} $ModeFullRadio
    ${NSD_Check} $ModeZCode
    ${NSD_Check} $ModeQoder
    ${NSD_Check} $ModeDeepSeek
    ${NSD_Check} $ModeAntigravity
  ${EndIf}
  ${NSD_OnClick} $ModeFullRadio UpdateModeControls
  ${NSD_OnClick} $ModeRtlRadio UpdateModeControls
  ${NSD_OnClick} $ModeFullDetail SelectFullMode
  ${NSD_OnClick} $ModeRtlDetail SelectRtlMode
  ${NSD_OnClick} $ModeZCode UpdateModeCount
  ${NSD_OnClick} $ModeQoder UpdateModeCount
  ${NSD_OnClick} $ModeDeepSeek UpdateModeCount
  ${NSD_OnClick} $ModeAntigravity UpdateModeCount
  Call UpdateModeControls
  nsDialogs::Show
FunctionEnd

Function SelectFullMode
  ${NSD_Check} $ModeFullRadio
  Call UpdateModeControls
FunctionEnd

Function SelectRtlMode
  ${NSD_Check} $ModeRtlRadio
  Call UpdateModeControls
FunctionEnd

Function SkipStartMenuPage
  ${If} $InstallMode == "rtl"
    Abort
  ${EndIf}
  Call SkipIfPassive
FunctionEnd

Function UpdateModeControls
  ${NSD_GetState} $ModeFullRadio $0
  ${If} $0 = ${BST_CHECKED}
    ${NSD_Check} $ModeZCode
    ${NSD_Check} $ModeQoder
    ${NSD_Check} $ModeDeepSeek
    ${NSD_Check} $ModeAntigravity
    EnableWindow $ModeZCode 0
    EnableWindow $ModeQoder 0
    EnableWindow $ModeDeepSeek 0
    EnableWindow $ModeAntigravity 0
  ${Else}
    ${If} $LegacyAgentRTL != ""
    ${AndIf} $PreviousInstallMode == ""
    ${AndIf} $LegacySelectionSeeded = 0
      StrCpy $LegacySelectionSeeded 1
      Call SeedLegacySelection
    ${EndIf}
    EnableWindow $ModeZCode 1
    EnableWindow $ModeQoder 1
    EnableWindow $ModeDeepSeek 1
    EnableWindow $ModeAntigravity 1
  ${EndIf}
  Call UpdateModeCount
FunctionEnd

Function UpdateModeCount
  ${NSD_GetState} $ModeFullRadio $0
  ${If} $0 = ${BST_CHECKED}
    StrCpy $R3 "$(VibeHubFullCount)"
  ${Else}
    ${NSD_GetState} $ModeZCode $0
    ${NSD_GetState} $ModeQoder $1
    ${NSD_GetState} $ModeDeepSeek $2
    IntOp $R0 $0 + $1
    IntOp $R0 $R0 + $2
    ${NSD_GetState} $ModeAntigravity $3
    IntOp $R0 $R0 + $3
    StrCpy $R3 "$(VibeHubCountSelected) $R0 $(VibeHubCountTotal)"
  ${EndIf}
  ${NSD_SetText} $ModeCountLabel $R3
FunctionEnd

Function SeedLegacySelection
  ${NSD_Uncheck} $ModeAntigravity
  ${NSD_Uncheck} $ModeZCode
  ${NSD_Uncheck} $ModeQoder
  ${NSD_Uncheck} $ModeDeepSeek
  ${If} $LegacyComponents == ""
    ${NSD_Check} $ModeZCode
    ${NSD_Check} $ModeQoder
    ${NSD_Check} $ModeDeepSeek
    Return
  ${EndIf}
  ${StrLoc} $R1 $LegacyComponents "zcode" ">"
  ${If} $R1 != "-1"
    ${NSD_Check} $ModeZCode
  ${EndIf}
  ${StrLoc} $R1 $LegacyComponents "qoder" ">"
  ${If} $R1 != "-1"
    ${NSD_Check} $ModeQoder
  ${EndIf}
  ${StrLoc} $R1 $LegacyComponents "deepseek" ">"
  ${If} $R1 != "-1"
    ${NSD_Check} $ModeDeepSeek
  ${EndIf}
FunctionEnd

Function LeaveSetupChoice
  ${NSD_GetState} $ModeFullRadio $0
  ${If} $0 = ${BST_CHECKED}
    StrCpy $InstallMode "full"
    StrCpy $SelectedComponents "zcode,qoder,deepseek-harness,antigravity"
    Call InitSelection
    Return
  ${EndIf}
  ${NSD_GetState} $ModeZCode $0
  ${NSD_GetState} $ModeQoder $1
  ${NSD_GetState} $ModeDeepSeek $2
  ${NSD_GetState} $ModeAntigravity $3
  ${If} $0 != ${BST_CHECKED}
  ${AndIf} $1 != ${BST_CHECKED}
  ${AndIf} $2 != ${BST_CHECKED}
  ${AndIf} $3 != ${BST_CHECKED}
    MessageBox MB_ICONSTOP "$(VibeHubNoRtl)"
    Abort
  ${EndIf}
  StrCpy $InstallMode "rtl"
  StrCpy $SelectedComponents ""
  ${If} $0 = ${BST_CHECKED}
    StrCpy $SelectedComponents "zcode"
    SectionSetFlags ${SEC_ZCODE} ${SF_SELECTED}
  ${Else}
    SectionSetFlags ${SEC_ZCODE} 0
  ${EndIf}
  ${If} $1 = ${BST_CHECKED}
    ${If} $SelectedComponents != ""
      StrCpy $SelectedComponents "$SelectedComponents,qoder"
    ${Else}
      StrCpy $SelectedComponents "qoder"
    ${EndIf}
    SectionSetFlags ${SEC_QODER} ${SF_SELECTED}
  ${Else}
    SectionSetFlags ${SEC_QODER} 0
  ${EndIf}
  ${If} $2 = ${BST_CHECKED}
    ${If} $SelectedComponents != ""
      StrCpy $SelectedComponents "$SelectedComponents,deepseek-harness"
    ${Else}
      StrCpy $SelectedComponents "deepseek-harness"
    ${EndIf}
    SectionSetFlags ${SEC_DEEPSEEK} ${SF_SELECTED}
  ${Else}
    SectionSetFlags ${SEC_DEEPSEEK} 0
  ${EndIf}
  ${If} $3 = ${BST_CHECKED}
    ${If} $SelectedComponents != ""
      StrCpy $SelectedComponents "$SelectedComponents,antigravity"
    ${Else}
      StrCpy $SelectedComponents "antigravity"
    ${EndIf}
    SectionSetFlags ${SEC_ANTIGRAVITY} ${SF_SELECTED}
  ${Else}
    SectionSetFlags ${SEC_ANTIGRAVITY} 0
  ${EndIf}
  SectionSetFlags ${SEC_INSTALL} 0
  SectionSetFlags ${SEC_RUNTIME} ${SF_SELECTED}
FunctionEnd

Function CreateRtlShortcuts
  SetShellVarContext current
  ${If} $InstallMode == "full"
    StrCpy $R0 "$INSTDIR\resources\apps"
    StrCpy $R4 "$SMPROGRAMS\$AppStartMenuFolder"
  ${Else}
    StrCpy $R0 "$INSTDIR\apps"
    StrCpy $R4 "$SMPROGRAMS\VibeHub"
  ${EndIf}
  CreateDirectory "$R4"
  ${If} $InstallMode == "full"
    StrCpy $R1 ${SF_SELECTED}
    StrCpy $R2 ${SF_SELECTED}
    StrCpy $R3 ${SF_SELECTED}
    StrCpy $R5 ${SF_SELECTED}
  ${Else}
    SectionGetFlags ${SEC_ZCODE} $R1
    SectionGetFlags ${SEC_QODER} $R2
    SectionGetFlags ${SEC_DEEPSEEK} $R3
    SectionGetFlags ${SEC_ANTIGRAVITY} $R5
  ${EndIf}
  ${If} $R1 & ${SF_SELECTED}
    CreateShortcut "$R4\ZCode RTL.lnk" "$R0\ZCode\launch.vbs"
    CreateShortcut "$DESKTOP\ZCode RTL.lnk" "$R0\ZCode\launch.vbs"
  ${EndIf}
  ${If} $R2 & ${SF_SELECTED}
    CreateShortcut "$R4\Qoder RTL.lnk" "$R0\Qoder\launch.vbs"
    CreateShortcut "$DESKTOP\Qoder RTL.lnk" "$R0\Qoder\launch.vbs"
  ${EndIf}
  ${If} $R3 & ${SF_SELECTED}
    CreateShortcut "$R4\DeepSeek Harness RTL.lnk" "$R0\DeepSeekHarness\launch.vbs"
    CreateShortcut "$DESKTOP\DeepSeek Harness RTL.lnk" "$R0\DeepSeekHarness\launch.vbs"
  ${EndIf}
  ${If} $R5 & ${SF_SELECTED}
    CreateShortcut "$R4\Antigravity RTL.lnk" "$R0\Antigravity\launch.vbs"
    CreateShortcut "$DESKTOP\Antigravity RTL.lnk" "$R0\Antigravity\launch.vbs"
  ${EndIf}
FunctionEnd

Function .onInstSuccess
  ; Check for `/R` flag only in silent and passive installers because
  ; GUI installer has a toggle for the user to (re)start the app
  ${If} $PassiveMode = 1
  ${OrIf} ${Silent}
    ${GetOptions} $CMDLINE "/R" $R0
    ${IfNot} ${Errors}
    ${AndIf} $InstallMode == "full"
      ${GetOptions} $CMDLINE "/ARGS" $R0
      nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" "$R0"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function un.onInit
  !insertmacro SetContext

  !if "${INSTALLMODE}" == "both"
    !insertmacro MULTIUSER_UNINIT
  !endif

  !insertmacro MUI_UNGETLANGUAGE

  ${GetOptions} $CMDLINE "/P" $PassiveMode
  ${IfNot} ${Errors}
    StrCpy $PassiveMode 1
  ${EndIf}

  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}
  ReadRegStr $InstallMode HKCU "${INSTALL_STATE_KEY}" "mode"
  ${If} $InstallMode == ""
    StrCpy $InstallMode "full"
  ${EndIf}
FunctionEnd

Section Uninstall

  !ifmacrodef NSIS_HOOK_PREUNINSTALL
    !insertmacro NSIS_HOOK_PREUNINSTALL
  !endif

  ${If} $InstallMode == "full"
    !insertmacro CheckIfAppIsRunning "$INSTDIR\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\cleanup.ps1" -Root "$INSTDIR\resources"'
  ${Else}
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\cleanup.ps1" -Root "$INSTDIR"'
  ${EndIf}

  ; Delete the app directory and its content from disk
  ; Copy main executable
  Delete "$INSTDIR\${MAINBINARYNAME}.exe"

  ; Delete resources
  {{#each resources}}
    Delete "$INSTDIR\\{{this.[1]}}"
  {{/each}}

  ; Delete external binaries
  {{#each binaries}}
    Delete "$INSTDIR\\{{this}}"
  {{/each}}

  ; Remove only files installed by the standalone RTL sections.
  Delete "$INSTDIR\apps\migrate-agentrtl-paths.ps1"
  Delete "$INSTDIR\apps\ZCode\start.ps1"
  Delete "$INSTDIR\apps\ZCode\launch.vbs"
  Delete "$INSTDIR\apps\ZCode\injector.mjs"
  Delete "$INSTDIR\apps\Qoder\start.ps1"
  Delete "$INSTDIR\apps\Qoder\launch.vbs"
  Delete "$INSTDIR\apps\Qoder\injector.mjs"
  Delete "$INSTDIR\apps\Qoder\style.mjs"
  Delete "$INSTDIR\apps\Qoder\doctor.mjs"
  Delete "$INSTDIR\apps\Qoder\LICENSE"
  Delete "$INSTDIR\apps\Qoder\assets\OFL.txt"
  Delete "$INSTDIR\apps\Qoder\assets\Vazirmatn-Bold.woff2"
  Delete "$INSTDIR\apps\Qoder\assets\Vazirmatn-Regular.woff2"
  Delete "$INSTDIR\apps\Antigravity\start.ps1"
  Delete "$INSTDIR\apps\Antigravity\launch.vbs"
  Delete "$INSTDIR\apps\Antigravity\injector.mjs"
  Delete "$INSTDIR\apps\Antigravity\style.mjs"
  Delete "$INSTDIR\apps\DeepSeekHarness\start.ps1"
  Delete "$INSTDIR\apps\DeepSeekHarness\launch.vbs"
  Delete "$INSTDIR\apps\DeepSeekHarness\injector.mjs"
  Delete "$INSTDIR\apps\DeepSeekHarness\assets\OFL.txt"
  Delete "$INSTDIR\apps\DeepSeekHarness\assets\Vazirmatn-Bold.woff2"
  Delete "$INSTDIR\apps\DeepSeekHarness\assets\Vazirmatn-Regular.woff2"
  Delete "$INSTDIR\apps\rtl-paths.ps1"
  Delete "$INSTDIR\apps\rtl-direction.mjs"
  Delete "$INSTDIR\cleanup.ps1"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\THIRD_PARTY_LICENSES.md"
  Delete "$INSTDIR\runtime\node.exe"
  Delete "$INSTDIR\licenses\NODE-LICENSE.md"
  RMDir "$INSTDIR\apps\ZCode"
  RMDir "$INSTDIR\apps\Qoder\assets"
  RMDir "$INSTDIR\apps\Qoder"
  RMDir "$INSTDIR\apps\DeepSeekHarness\assets"
  RMDir "$INSTDIR\apps\DeepSeekHarness"
  RMDir "$INSTDIR\apps\Antigravity"
  RMDir "$INSTDIR\apps"
  RMDir "$INSTDIR\runtime"
  RMDir "$INSTDIR\licenses"

  ; Delete app associations
  {{#each file_associations as |association| ~}}
    {{#each association.ext as |ext| ~}}
      !insertmacro APP_UNASSOCIATE "{{ext}}" "{{or association.name ext}}"
    {{/each}}
  {{/each}}

  ; Delete deep links
  {{#each deep_link_protocols as |protocol| ~}}
    ReadRegStr $R7 SHCTX "Software\Classes\\{{protocol}}\shell\open\command" ""
    ${If} $R7 == "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
      DeleteRegKey SHCTX "Software\Classes\\{{protocol}}"
    ${EndIf}
  {{/each}}


  ; Delete uninstaller
  Delete "$INSTDIR\uninstall.exe"

  ; Remove the standalone launcher shortcuts only when they still point to our files.
  StrCpy $R0 "$INSTDIR\apps"
  StrCpy $R4 "$SMPROGRAMS\VibeHub"
  ${If} $InstallMode == "full"
    StrCpy $R0 "$INSTDIR\resources\apps"
    !insertmacro MUI_STARTMENU_GETFOLDER Application $AppStartMenuFolder
    StrCpy $R4 "$SMPROGRAMS\$AppStartMenuFolder"
  ${EndIf}
  !insertmacro IsShortcutTarget "$R4\ZCode RTL.lnk" "$R0\ZCode\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$R4\ZCode RTL.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$DESKTOP\ZCode RTL.lnk" "$R0\ZCode\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$DESKTOP\ZCode RTL.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$R4\Qoder RTL.lnk" "$R0\Qoder\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$R4\Qoder RTL.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$DESKTOP\Qoder RTL.lnk" "$R0\Qoder\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$DESKTOP\Qoder RTL.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$R4\DeepSeek Harness RTL.lnk" "$R0\DeepSeekHarness\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$R4\DeepSeek Harness RTL.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$R4\Antigravity RTL.lnk" "$R0\Antigravity\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$R4\Antigravity RTL.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$DESKTOP\DeepSeek Harness RTL.lnk" "$R0\DeepSeekHarness\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$DESKTOP\DeepSeek Harness RTL.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$DESKTOP\Antigravity RTL.lnk" "$R0\Antigravity\launch.vbs"
  Pop $0
  ${If} $0 = 1
    Delete "$DESKTOP\Antigravity RTL.lnk"
  ${EndIf}
  RMDir "$R4"

  {{#each resources_ancestors}}
  RMDir /REBOOTOK "$INSTDIR\\{{this}}"
  {{/each}}
  RMDir "$INSTDIR"

  ; Remove shortcuts if not updating
  ${If} $UpdateMode <> 1
    !insertmacro DeleteAppUserModelId

    ; Remove start menu shortcut
    !insertmacro MUI_STARTMENU_GETFOLDER Application $AppStartMenuFolder
    !insertmacro IsShortcutTarget "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
      RMDir "$SMPROGRAMS\$AppStartMenuFolder"
    ${EndIf}
    !insertmacro IsShortcutTarget "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${EndIf}

    ; Remove desktop shortcuts
    !insertmacro IsShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$DESKTOP\${PRODUCTNAME}.lnk"
      Delete "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}
  ${EndIf}

  ; Remove registry information for add/remove programs
  !if "${INSTALLMODE}" == "both"
    DeleteRegKey SHCTX "${UNINSTKEY}"
  !else if "${INSTALLMODE}" == "perMachine"
    DeleteRegKey HKLM "${UNINSTKEY}"
  !else
    DeleteRegKey HKCU "${UNINSTKEY}"
  !endif

  ; Removes the Autostart entry for ${PRODUCTNAME} from the HKCU Run key if it exists.
  ; This ensures the program does not launch automatically after uninstallation if it exists.
  ; If it doesn't exist, it does nothing.
  ; We do this when not updating (to preserve the registry value on updates)
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  ${EndIf}

  ; Delete app data if the checkbox is selected
  ; and if not updating
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    ; Clear the install location $INSTDIR from registry
    DeleteRegKey SHCTX "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty SHCTX "${MANUKEY}"

    ; Clear the install language from registry
    DeleteRegValue HKCU "${MANUPRODUCTKEY}" "Installer Language"
    DeleteRegKey /ifempty HKCU "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty HKCU "${MANUKEY}"

    SetShellVarContext current
    RmDir /r "$APPDATA\${BUNDLEID}"
    RmDir /r "$LOCALAPPDATA\${BUNDLEID}"
    Delete "$LOCALAPPDATA\ahmadkhanloo\VibeHub\rtl-paths.json"
    RMDir "$LOCALAPPDATA\ahmadkhanloo\VibeHub"
  ${EndIf}

  ${If} $UpdateMode <> 1
    DeleteRegKey HKCU "${INSTALL_STATE_KEY}"
  ${EndIf}

  !ifmacrodef NSIS_HOOK_POSTUNINSTALL
    !insertmacro NSIS_HOOK_POSTUNINSTALL
  !endif

  ; Auto close if passive mode or updating
  ${If} $PassiveMode = 1
  ${OrIf} $UpdateMode = 1
    SetAutoClose true
  ${EndIf}
SectionEnd

Function RestorePreviousInstallLocation
  ReadRegStr $4 SHCTX "${MANUPRODUCTKEY}" ""
  StrCmp $4 "" +2 0
    StrCpy $INSTDIR $4
FunctionEnd

Function Skip
  Abort
FunctionEnd

Function SkipIfPassive
  ${IfThen} $PassiveMode = 1  ${|} Abort ${|}
FunctionEnd
Function un.SkipIfPassive
  ${IfThen} $PassiveMode = 1  ${|} Abort ${|}
FunctionEnd

Function CreateOrUpdateStartMenuShortcut
  ; We used to use product name as MAINBINARYNAME
  ; migrate old shortcuts to target the new MAINBINARYNAME
  StrCpy $R0 0

  !insertmacro IsShortcutTarget "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\$OldMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    StrCpy $R0 1
  ${EndIf}

  !insertmacro IsShortcutTarget "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\$OldMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    StrCpy $R0 1
  ${EndIf}

  ${If} $R0 = 1
    Return
  ${EndIf}

  ; Skip creating shortcut if in update mode or no shortcut mode
  ; but always create if migrating from wix
  ${If} $WixMode = 0
    ${If} $UpdateMode = 1
    ${OrIf} $NoShortcutMode = 1
      Return
    ${EndIf}
  ${EndIf}

  !if "${STARTMENUFOLDER}" != ""
    CreateDirectory "$SMPROGRAMS\$AppStartMenuFolder"
    CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
  !else
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  !endif
FunctionEnd

Function CreateOrUpdateDesktopShortcut
  ; We used to use product name as MAINBINARYNAME
  ; migrate old shortcuts to target the new MAINBINARYNAME
  !insertmacro IsShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\$OldMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Return
  ${EndIf}

  ; Skip creating shortcut if in update mode or no shortcut mode
  ; but always create if migrating from wix
  ${If} $WixMode = 0
    ${If} $UpdateMode = 1
    ${OrIf} $NoShortcutMode = 1
      Return
    ${EndIf}
  ${EndIf}

  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
FunctionEnd
