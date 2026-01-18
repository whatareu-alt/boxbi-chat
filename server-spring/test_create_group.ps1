$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8081"

# 1. Signup User
$signupBody = @{
    username = "testuser_grp"
    email = "test@example.com"
    firstName = "Test"
    lastName = "User"
    secret = "password123"
} | ConvertTo-Json

try {
    Write-Host "Signing up..."
    $signupResponse = Invoke-RestMethod -Uri "$baseUrl/signup" -Method Post -Body $signupBody -ContentType "application/json"
    Write-Host "Signup successful: $($signupResponse.username)"
} catch {
    Write-Host "Signup failed or user exists: $_"
    # Try login if signup fails
    try {
        $loginBody = @{ username = "testuser_grp"; secret = "password123" } | ConvertTo-Json
        $signupResponse = Invoke-RestMethod -Uri "$baseUrl/login" -Method Post -Body $loginBody -ContentType "application/json"
         Write-Host "Login successful: $($signupResponse.username)"
    } catch {
        Write-Error "Could not login or signup: $_"
    }
}

# 2. Create Group
$groupBody = @{
    name = "Test Group"
    createdBy = "testuser_grp"
    members = @("testuser_grp")
} | ConvertTo-Json

try {
    Write-Host "Creating group..."
    $groupResponse = Invoke-RestMethod -Uri "$baseUrl/groups/create" -Method Post -Body $groupBody -ContentType "application/json"
    Write-Host "Group created successfully!"
    Write-Host ($groupResponse | ConvertTo-Json -Depth 5)
} catch {
    Write-Error "Group creation failed: $_"
    $_.Exception.Response.GetResponseStream() | %{ [System.IO.StreamReader]::new($_).ReadToEnd() } | Write-Host
}
