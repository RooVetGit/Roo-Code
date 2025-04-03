
var KNe = `
auto_approval:
  git:
    - type: prefix
      args: ["status"]
    - type: prefix
      args: ["log"]
    - type: prefix
      args: ["diff"]
    - type: prefix
      args: ["show"]
    - type: exact
      args: ["branch"]
    - type: prefix
      args: ["ls-files"]
    - type: prefix
      args: ["blame"]
    - type: prefix
      args: ["rev-parse"]
    - type: prefix
      args: ["remote", "-v"]
    - type: prefix
      args: ["config", "--list"]
    - type: exact
      args: ["config", "user.name"]
    - type: exact
      args: ["config", "user.email"]
    - type: exact
      args: ["branch", "--show-current"]

  kubectl:
    - type: prefix
      args: ["get"]
    - type: prefix
      args: ["describe"]
    - type: prefix
      args: ["explain"]
    - type: prefix
      args: ["logs"]
    - type: prefix
      args: ["top"]
    - type: prefix
      args: ["api-resources"]
    - type: prefix
      args: ["api-versions"]
    - type: prefix
      args: ["version"]
    - type: prefix
      args: ["wait"]
    - type: prefix
      args: ["auth", "can-i"]
    - type: prefix
      args: ["config", "get-contexts"]
    - type: prefix
      args: ["config", "view"]

  bazel:
    - type: prefix
      args: ["query"]
    - type: prefix
      args: ["cquery"]
    - type: prefix
      args: ["config"]
    - type: prefix
      args: ["info"]
    - type: prefix
      args: ["version"]
    - type: prefix
      args: ["help"]
    - type: prefix
      args: ["analyze-profile"]
    - type: prefix
      args: ["aquery"]
    - type: prefix
      args: ["dump"]
    - type: prefix
      args: ["license"]
    - type: prefix
      args: ["print"]
    - type: prefix
      args: ["build", "--nobuild"]
    - type: prefix
      args: ["coverage", "--nobuild"]
    - type: prefix
      args: ["mobile-install", "--nobuild"]
    - type: prefix
      args: ["run", "--nobuild"]
    - type: prefix
      args: ["text", "--nobuild"]
    - type: prefix
      args: ["clean", "--expunge", "--dry-run"]

  docker:
    - type: prefix
      args: ["ps"]
    - type: prefix
      args: ["images"]
    - type: prefix
      args: ["network", "ls"]
    - type: prefix
      args: ["volume", "ls"]
    - type: prefix
      args: ["port"]
    - type: prefix
      args: ["stats"]
    - type: prefix
      args: ["events"]
    - type: prefix
      args: ["diff"]
    - type: prefix
      args: ["history"]
    - type: prefix
      args: ["system", "df"]
    - type: prefix
      args: ["top"]
    - type: prefix
      args: ["version"]
    - type: prefix
      args: ["inspect"]

  npm:
    - type: prefix
      args: ["list"]
    - type: prefix
      args: ["outdated"]
    - type: prefix
      args: ["doctor"]
    - type: prefix
      args: ["audit"]
    - type: prefix
      args: ["token", "list"]
    - type: prefix
      args: ["ping"]
    - type: prefix
      args: ["view"]
    - type: prefix
      args: ["owner", "ls"]
    - type: prefix
      args: ["fund"]
    - type: prefix
      args: ["explain"]
    - type: prefix
      args: ["ls"]
    - type: prefix
      args: ["why"]
    - type: prefix
      args: ["prefix"]

  terraform:
    - type: prefix
      args: ["show"]
    - type: prefix
      args: ["providers"]
    - type: prefix
      args: ["state", "list"]
    - type: prefix
      args: ["state", "show"]
    - type: prefix
      args: ["version"]
    - type: prefix
      args: ["fmt", "--check"]
    - type: prefix
      args: ["validate"]
    - type: prefix
      args: ["graph"]
    - type: prefix
      args: ["console"]
    - type: prefix
      args: ["output"]
    - type: prefix
      args: ["refresh", "--dry-run"]
    - type: prefix
      args: ["plan"]

  gradle:
    - type: prefix
      args: ["dependencies"]
    - type: prefix
      args: ["projects"]
    - type: prefix
      args: ["properties"]
    - type: prefix
      args: ["tasks"]
    - type: prefix
      args: ["components"]
    - type: prefix
      args: ["model"]
    - type: prefix
      args: ["buildEnvironment"]
    - type: prefix
      args: ["projectsEvaluated"]
    - type: prefix
      args: ["projects", "--dry-run"]
    - type: prefix
      args: ["dependencies", "--dry-run"]
    - type: prefix
      args: ["help"]
    - type: prefix
      args: ["version"]

  helm:
    - type: prefix
      args: ["list"]
    - type: prefix
      args: ["get", "values"]
    - type: prefix
      args: ["get", "manifest"]
    - type: prefix
      args: ["get", "hooks"]
    - type: prefix
      args: ["get", "notes"]
    - type: prefix
      args: ["status"]
    - type: prefix
      args: ["dependency", "list"]
    - type: prefix
      args: ["show", "chart"]
    - type: prefix
      args: ["show", "values"]
    - type: prefix
      args: ["verify"]
    - type: prefix
      args: ["version"]
    - type: prefix
      args: ["env"]

  aws:
    - type: prefix
      args: ["s3", "ls"]
    - type: prefix
      args: ["ec2", "describe-instances"]
    - type: prefix
      args: ["rds", "describe-db-instances"]
    - type: prefix
      args: ["iam", "list-users"]
    - type: prefix
      args: ["iam", "list-roles"]
    - type: prefix
      args: ["lambda", "list-functions"]
    - type: prefix
      args: ["eks", "list-clusters"]
    - type: prefix
      args: ["ecr", "describe-repositories"]
    - type: prefix
      args: ["cloudformation", "list-stacks"]
    - type: prefix
      args: ["configure", "list"]

  gcloud:
    - type: prefix
      args: ["projects", "list"]
    - type: prefix
      args: ["compute", "instances", "list"]
    - type: prefix
      args: ["compute", "zones", "list"]
    - type: prefix
      args: ["compute", "regions", "list"]
    - type: prefix
      args: ["container", "clusters", "list"]
    - type: prefix
      args: ["services", "list"]
    - type: prefix
      args: ["iam", "roles", "list"]
    - type: prefix
      args: ["config", "list"]
    - type: prefix
      args: ["components", "list"]
    - type: prefix
      args: ["version"]

  postgres:
    - type: prefix
      args: ["psql", "-l"]
    - type: prefix
      args: ["pg_dump", "--schema-only"]
    - type: prefix
      args: ["pg_dump", "--schema", "public", "--dry-run"]
    - type: prefix
      args: ["pg_dump", "-s", "-t"]
    - type: prefix
      args: ["pg_controldata"]
    - type: prefix
      args: ["pg_isready"]
    - type: prefix
      args: ["pg_lsclusters"]
    - type: prefix
      args: ["pg_activity"]
    - type: prefix
      args: ["pgbench", "-i", "--dry-run"]

  maven:
    - type: prefix
      args: ["dependency:tree"]
    - type: prefix
      args: ["dependency:analyze"]
    - type: prefix
      args: ["help:effective-pom"]
    - type: prefix
      args: ["help:describe"]
    - type: prefix
      args: ["help:evaluate"]
    - type: prefix
      args: ["dependency:list"]
    - type: prefix
      args: ["dependency:build-classpath"]
    - type: prefix
      args: ["help:active-profiles"]
    - type: prefix
      args: ["help:effective-settings"]
    - type: prefix
      args: ["version"]

  redis-cli:
    - type: prefix
      args: ["info"]
    - type: prefix
      args: ["monitor"]
    - type: prefix
      args: ["memory", "stats"]
    - type: prefix
      args: ["memory", "doctor"]
    - type: prefix
      args: ["latency", "doctor"]
    - type: prefix
      args: ["cluster", "info"]
    - type: prefix
      args: ["client", "list"]
    - type: prefix
      args: ["slowlog", "get"]
    - type: prefix
      args: ["config", "get"]
    - type: prefix
      args: ["info", "keyspace"]

  yarn:
    - type: prefix
      args: ["list"]
    - type: prefix
      args: ["info"]
    - type: prefix
      args: ["why"]
    - type: prefix
      args: ["licenses", "list"]
    - type: prefix
      args: ["outdated"]
    - type: prefix
      args: ["check"]
    - type: prefix
      args: ["audit"]
    - type: prefix
      args: ["workspaces", "info"]
    - type: prefix
      args: ["version"]
    - type: prefix
      args: ["config", "list"]

  az:
    - type: prefix
      args: ["account", "list"]
    - type: prefix
      args: ["group", "list"]
    - type: prefix
      args: ["vm", "list"]
    - type: prefix
      args: ["aks", "list"]
    - type: prefix
      args: ["acr", "list"]
    - type: prefix
      args: ["storage", "account", "list"]
    - type: prefix
      args: ["network", "vnet", "list"]
    - type: prefix
      args: ["webapp", "list"]
    - type: prefix
      args: ["functionapp", "list"]
    - type: prefix
      args: ["version"]

  vault:
    - type: prefix
      args: ["list"]
    - type: prefix
      args: ["policy", "list"]
    - type: prefix
      args: ["auth", "list"]
    - type: prefix
      args: ["secrets", "list"]
    - type: prefix
      args: ["audit", "list"]
    - type: prefix
      args: ["status"]
    - type: prefix
      args: ["token", "lookup"]
    - type: prefix
      args: ["read"]
    - type: prefix
      args: ["version"]

  podman:
    - type: prefix
      args: ["ps"]
    - type: prefix
      args: ["images"]
    - type: prefix
      args: ["pod", "ps"]
    - type: prefix
      args: ["volume", "ls"]
    - type: prefix
      args: ["network", "ls"]
    - type: prefix
      args: ["stats"]
    - type: prefix
      args: ["top"]
    - type: prefix
      args: ["logs"]
    - type: prefix
      args: ["inspect"]
    - type: prefix
      args: ["port"]

  deno:
    - type: prefix
      args: ["info"]
    - type: prefix
      args: ["list"]
    - type: prefix
      args: ["doc"]
    - type: prefix
      args: ["lint"]
    - type: prefix
      args: ["types"]
    - type: prefix
      args: ["check"]
    - type: prefix
      args: ["compile", "--dry-run"]
    - type: prefix
      args: ["task", "--list"]
    - type: prefix
      args: ["test", "--dry-run"]
    - type: prefix
      args: ["version"]

  rustup:
    - type: prefix
      args: ["show"]
    - type: prefix
      args: ["toolchain", "list"]
    - type: prefix
      args: ["target", "list"]
    - type: prefix
      args: ["component", "list"]
    - type: prefix
      args: ["override", "list"]
    - type: prefix
      args: ["which"]
    - type: prefix
      args: ["doc"]
    - type: prefix
      args: ["man"]
    - type: prefix
      args: ["version"]

  cargo:
    - type: prefix
      args: ["tree"]
    - type: prefix
      args: ["metadata"]
    - type: prefix
      args: ["list"]
    - type: prefix
      args: ["verify"]
    - type: prefix
      args: ["search"]
    - type: prefix
      args: ["vendor", "--dry-run"]
    - type: prefix
      args: ["outdated"]
    - type: prefix
      args: ["doc"]
    - type: prefix
      args: ["config", "get"]
    - type: prefix
      args: ["version"]

  pip:
    - type: prefix
      args: ["list"]
    - type: prefix
      args: ["show"]
    - type: prefix
      args: ["check"]
    - type: prefix
      args: ["debug"]
    - type: prefix
      args: ["config", "list"]
    - type: prefix
      args: ["index"]
    - type: prefix
      args: ["hash"]
    - type: prefix
      args: ["cache", "list"]
    - type: prefix
      args: ["freeze"]
    - type: prefix
      args: ["version"]
`,
	JNe = `
auto_approval:
  cd:
    type: any
  date:
    type: any
  cal:
    type: any
  uname:
    type: prefix
    args: ["-a"]
  hostname:
    type: any
  whoami:
    type: any
  id:
    type: any
  ps:
    type: any
  free:
    type: any
  w:
    type: any
  who:
    type: any
  ping:
    type: not_contains
    args: ["-f"]
  netstat:
    type: any
  ss:
    type: any
  ip:
    type: prefix
    args: ["addr"]
  dig:
    type: any
  nslookup:
    type: any
  pwd:
    type: any
  ls:
    type: any
  file:
    type: any
  stat:
    type: any
  du:
    type: any
  df:
    type: any
  cat:
    type: any
  less:
    type: any
  more:
    type: any
  head:
    type: any
  tail:
    type: not_contains
    args: ["-f"]
  wc:
    type: any
`,
	zNe = `
auto_approval:
  cd:
    type: any
  Get-Date:
    type: any
  date:
    type: any
  Get-ComputerInfo:
    type: any
  Get-Host:
    type: any
  $env:USERNAME:
    type: any
  whoami:
    type: any
  Get-Process:
    type: any
  ps:
    type: any
  gps:
    type: any
  Get-Service:
    type: any
  gsv:
    type: any
  Get-NetIPAddress:
    type: any
  ipconfig:
    type: any
  Get-NetTCPConnection:
    type: any
  netstat:
    type: any
  Resolve-DnsName:
    type: any
  nslookup:
    type: any
  Get-DnsClientServerAddress:
    type: any
  Get-Location:
    type: any
  pwd:
    type: any
  gl:
    type: any
  Get-ChildItem:
    type: any
  dir:
    type: any
  ls:
    type: any
  gci:
    type: any
  Get-Item:
    type: any
  gi:
    type: any
  Get-ItemProperty:
    type: any
  gp:
    type: any
  Get-Content:
    type: not_contains
    args: ["-Wait"]
  cat:
    type: any
  gc:
    type: any
  type:
    type: any
  Select-String:
    type: any
  sls:
    type: any
  findstr:
    type: any
  Get-PSDrive:
    type: any
  gdr:
    type: any
  Get-Volume:
    type: any
  Measure-Object:
    type: any
  measure:
    type: any
  Select-Object:
    type: any
  select:
    type: any
`