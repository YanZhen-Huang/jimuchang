; 积木剧场 Windows 安装包（Inno Setup 6）
; 由 GitHub Actions 在 windows-latest 上编译（见 .github/workflows/windows.yml）

[Setup]
AppId={{A7C4E2F1-3B9D-4E6A-8C21-0123456789AB}
AppName=积木剧场
AppVersion=0.3.1
AppPublisher=YanZhen Huang
AppPublisherURL=https://github.com/YanZhen-Huang/jimuchang
DefaultDirName={autopf}\Jimuchang
DefaultGroupName=积木剧场
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=Jimuchang-Setup-0.3.1
SetupIconFile=jimuchang.ico
UninstallDisplayIcon={app}\jimuchang.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："

[Files]
Source: "..\..\dist\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\积木剧场"; Filename: "{app}\jimuchang.exe"
Name: "{group}\卸载积木剧场"; Filename: "{uninstallexe}"
Name: "{autodesktop}\积木剧场"; Filename: "{app}\jimuchang.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\jimuchang.exe"; Description: "启动积木剧场"; Flags: nowait postinstall skipifsilent
