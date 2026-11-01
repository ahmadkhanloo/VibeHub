function ConvertFrom-ReleaseHttpContent {
    param([Parameter(Mandatory)][AllowEmptyString()][object]$Content)
    if ($Content -is [byte[]]) {
        return [Text.UTF8Encoding]::new($false, $true).GetString($Content)
    }
    if ($Content -is [string]) { return $Content }
    throw 'Release HTTP response must be text or UTF-8 bytes'
}
