# SHINE Production Runbooks
**Operational Procedures for Production Environment**

---

## 🚨 Emergency Response

### Incident Response Team
- **Primary On-Call**: [Contact Info]
- **Secondary On-Call**: [Contact Info]
- **Technical Lead**: [Contact Info]
- **Product Owner**: [Contact Info]
- **Security Officer**: [Contact Info]

### Critical Incident Response (P0)
1. **Immediate Response (0-15 minutes)**
   - Acknowledge alert
   - Assess impact and severity
   - Create incident channel (#incident-YYYY-MM-DD-HH-MM)
   - Notify stakeholders

2. **Mitigation (15-60 minutes)**
   - Implement immediate workaround
   - Gather initial evidence
   - Activate additional resources if needed
   - Communicate status to leadership

3. **Resolution (1-4 hours)**
   - Implement permanent fix
   - Verify resolution
   - Monitor for regression
   - Update incident documentation

4. **Post-Incident (24-72 hours)**
   - Conduct blameless postmortem
   - Document lessons learned
   - Implement preventive measures
   - Update runbooks and alerts

---

## 📊 Monitoring & Alerting

### Key Performance Indicators (KPIs)
- **API Latency P95**: ≤ 500ms (Alert at >800ms)
- **Error Rate**: ≤ 1% (Alert at >2%)
- **Booking Success Rate**: ≥ 98% (Alert at <95%)
- **Dispatch Time P95**: ≤ 120s (Alert at >180s) 
- **Database Connections**: ≤ 80% (Alert at >90%)

### Critical Alerts

#### API Error Rate > 2% (5 minutes)
```bash
# Investigation Steps
1. Check service health dashboard
2. Review recent deployments
3. Check database connectivity
4. Review application logs
5. Check third-party service status (Stripe, MongoDB)

# Mitigation
- If deployment-related: Rollback to previous version
- If database-related: Check connection pool, restart if needed
- If third-party: Check status pages, implement fallback
```

#### Dispatch Time P95 > 180s
```bash
# Investigation Steps
1. Check partner online count
2. Review geolocation service performance
3. Check dispatch algorithm performance
4. Review partner acceptance rates

# Mitigation
- Scale up dispatch workers
- Review dispatch radius settings
- Check partner incentives/bonuses
- Manual dispatch assistance if needed
```

#### Booking Creation 500s > 0 (5 minutes)
```bash
# Investigation Steps
1. Check payment processing (Stripe webhooks)
2. Review database transaction logs
3. Check pricing engine performance
4. Review validation errors

# Mitigation
- Check Stripe dashboard for payment issues
- Restart payment processing workers
- Review failed booking queue
- Manual booking assistance if needed
```

#### Push Notification Failure Rate > 5% (15 minutes)
```bash
# Investigation Steps
1. Check FCM/APNs service status
2. Review device token validity
3. Check notification queue
4. Review certificate expiration

# Mitigation
- Update FCM/APNs certificates if expired
- Clear invalid device tokens
- Restart notification workers
- Send follow-up SMS if critical notifications
```

---

## 🚀 Deployment Procedures

### Staging Deployment
```bash
# Pre-deployment Checklist
1. ✅ All tests passing (unit, integration, e2e)
2. ✅ Code review approved
3. ✅ Feature flags configured
4. ✅ Database migrations tested
5. ✅ Third-party integrations verified

# Deployment Steps
1. Deploy backend to staging
   - Update container image
   - Run database migrations
   - Verify health checks
   
2. Deploy frontend to staging
   - Build and upload to CDN
   - Update version in app stores (internal track)
   - Verify functionality

3. Run E2E tests
   - Customer booking flow
   - Partner job completion
   - Owner dashboard functionality
   - Payment processing

4. Performance validation
   - Load test with 10x normal traffic
   - Verify P95 latencies
   - Check resource utilization
```

### Production Deployment
```bash
# Pre-deployment Checklist
1. ✅ Staging deployment successful
2. ✅ E2E tests passing
3. ✅ Performance tests passing
4. ✅ Security scan completed
5. ✅ Deployment approval obtained
6. ✅ Rollback plan prepared

# Canary Deployment (10% traffic)
1. Deploy to canary cluster
2. Route 10% traffic to canary
3. Monitor for 30 minutes:
   - Error rates
   - Latency percentiles
   - Business metrics
   - User feedback

# Full Deployment (if canary successful)
1. Route 50% traffic to new version
2. Monitor for 15 minutes
3. Route 100% traffic to new version
4. Monitor for 60 minutes
5. Update mobile app store listings

# Rollback Procedure (if issues detected)
1. Immediately route traffic back to previous version
2. Investigate issues in parallel
3. Fix and redeploy to staging first
4. Schedule new production deployment
```

---

## 💾 Database Operations

### Backup & Recovery
```bash
# Daily Backup Verification
1. Verify automated backup completed
2. Test backup integrity
3. Confirm backup encryption
4. Update backup inventory

# Point-in-Time Recovery
1. Identify recovery point (timestamp)
2. Create new database cluster from backup
3. Restore to specific timestamp
4. Verify data integrity
5. Update application connection strings
6. Test application functionality

# Database Migration
1. Test migration on staging with production data copy
2. Create pre-migration backup
3. Enable maintenance mode
4. Run migration scripts
5. Verify migration success
6. Disable maintenance mode
7. Monitor application performance
```

### Performance Optimization
```bash
# Query Performance Investigation
1. Enable slow query logging
2. Analyze query patterns
3. Check index usage
4. Review connection pool metrics
5. Optimize problematic queries

# Database Scaling
1. Monitor resource utilization
2. Scale read replicas if read-heavy
3. Scale compute resources if CPU-bound
4. Consider sharding if data-heavy
5. Update connection pool settings
```

---

## 🔒 Security Operations

### Security Incident Response
```bash
# Security Alert Investigation
1. Preserve evidence (logs, network captures)
2. Assess impact and scope
3. Contain the incident
4. Eradicate the threat
5. Recover and validate
6. Document lessons learned

# Suspicious Activity Response
1. Check rate limiting logs
2. Review authentication failures
3. Analyze access patterns
4. Block suspicious IPs if needed
5. Review user account activity
6. Update security rules
```

### Certificate Management
```bash
# SSL Certificate Renewal
1. Monitor certificate expiration (30-day alert)
2. Generate new certificate
3. Test certificate in staging
4. Deploy to production during maintenance window
5. Verify SSL configuration
6. Update monitoring

# APNs/FCM Certificate Updates
1. Generate new certificates from Apple/Google
2. Update in secrets manager
3. Test push notifications in staging
4. Deploy to production
5. Monitor push notification success rates
```

---

## 💳 Payment Operations

### Stripe Integration Management
```bash
# Payment Failure Investigation
1. Check Stripe dashboard for errors
2. Review webhook delivery logs
3. Verify API key validity
4. Check payment method issues
5. Review dispute/chargeback queue

# Payout Processing
1. Monitor daily payout batches
2. Verify partner bank account details
3. Handle failed payouts
4. Review dispute resolution
5. Update partner payment status

# Fraud Detection
1. Monitor unusual payment patterns
2. Review high-value transactions
3. Check velocity rules
4. Update fraud detection rules
5. Handle chargebacks
```

---

## 📱 Mobile App Operations

### App Store Management
```bash
# iOS App Store
1. Monitor App Store Connect for reviews
2. Respond to user feedback
3. Track app performance metrics
4. Handle app rejection issues
5. Manage TestFlight beta testing

# Google Play Store  
1. Monitor Play Console for reviews
2. Track crash reports and ANRs
3. Manage internal testing tracks
4. Handle policy violation issues
5. Update app store listings
```

### Push Notification Management
```bash
# Notification Campaign
1. Segment target audience
2. Compose notification content
3. Test on staging environment
4. Schedule notification delivery
5. Monitor delivery rates
6. Analyze engagement metrics

# Notification Troubleshooting
1. Verify device token validity
2. Check notification payload
3. Review delivery logs
4. Test on multiple devices
5. Update notification templates
```

---

## 🎯 Business Operations

### Platform Pricing Management
```bash
# Surge Pricing Adjustment
1. Monitor demand/supply metrics
2. Analyze booking success rates
3. Adjust surge multipliers
4. Test pricing changes in staging
5. Deploy pricing updates
6. Monitor business impact

# Partner Payout Analysis
1. Review partner earnings reports
2. Analyze take rate effectiveness
3. Monitor partner satisfaction
4. Adjust payout structures if needed
5. Communicate changes to partners
```

### Customer Support Escalation
```bash
# Support Ticket Escalation
1. Review high-priority tickets
2. Investigate technical issues
3. Provide resolution or workaround
4. Update customer with status
5. Document resolution in knowledge base

# Refund Processing
1. Verify refund eligibility
2. Process refund in Stripe
3. Update booking status
4. Notify customer
5. Update internal records
```

---

## 📈 Performance Optimization

### Application Performance
```bash
# Performance Investigation
1. Review APM dashboards
2. Analyze slow endpoints
3. Check database query performance
4. Review caching effectiveness
5. Identify optimization opportunities

# Scaling Decisions
1. Monitor resource utilization
2. Analyze traffic patterns
3. Review cost implications
4. Scale infrastructure components
5. Update capacity planning
```

### Cost Optimization
```bash
# Monthly Cost Review
1. Analyze cloud infrastructure costs
2. Review third-party service usage
3. Identify optimization opportunities
4. Implement cost-saving measures
5. Update budget forecasts
```

---

## 🔄 Routine Maintenance

### Daily Operations
- [ ] Review overnight alerts and incidents
- [ ] Check system health dashboards
- [ ] Verify backup completion
- [ ] Monitor payment processing
- [ ] Review customer support queue

### Weekly Operations
- [ ] Review performance trends
- [ ] Analyze business metrics
- [ ] Update security patches
- [ ] Review partner payouts
- [ ] Conduct team operational review

### Monthly Operations
- [ ] Review and update runbooks
- [ ] Conduct disaster recovery testing
- [ ] Review security policies
- [ ] Analyze cost optimization opportunities
- [ ] Update capacity planning

---

## 📞 Contact Information

### Emergency Contacts
- **Primary On-Call**: +1-XXX-XXX-XXXX
- **Secondary On-Call**: +1-XXX-XXX-XXXX
- **Engineering Manager**: +1-XXX-XXX-XXXX
- **Product Manager**: +1-XXX-XXX-XXXX
- **Security Team**: security@shine.app

### Service Contacts
- **Stripe Support**: support@stripe.com
- **MongoDB Atlas**: support@mongodb.com
- **AWS Support**: [Support Case System]
- **APNs Support**: developer.apple.com/support
- **FCM Support**: firebase.google.com/support

---

*Last Updated: 2025-01-27*  
*Version: v1.0.0*  
*Owner: Engineering Team*