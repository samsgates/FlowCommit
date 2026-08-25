package flowcommit.transaction

import rego.v1

default decision := {"allow": false, "reason": "default deny"}

# Development starter policy. Replace with organization-specific policy before production.
decision := out if {
  input.transaction.environmentId != "production"
  out := {"allow": true, "reason": "non-production starter policy"}
}

decision := out if {
  input.transaction.environmentId == "production"
  input.transaction.riskLevel == "LOW"
  out := {"allow": true, "reason": "low-risk production transaction"}
}

decision := out if {
  input.transaction.environmentId == "production"
  input.transaction.riskLevel == "HIGH"
  out := {
    "allow": true,
    "reason": "high-risk transaction requires approval",
    "requiredApprovals": [{"role":"business-approver","count":1}]
  }
}

decision := out if {
  input.transaction.environmentId == "production"
  input.transaction.riskLevel == "CRITICAL"
  out := {
    "allow": true,
    "reason": "critical transaction requires dual approval",
    "requiredApprovals": [{"role":"business-approver","count":2}]
  }
}
