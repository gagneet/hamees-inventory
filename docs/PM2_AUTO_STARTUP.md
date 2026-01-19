# PM2 Auto-Startup Configuration

## Overview

This document describes the PM2 auto-startup configuration for the Hamees Inventory Management System and related applications on this server. The configuration ensures that all Node.js applications automatically start when the server reboots.

## Configured Applications

### 1. Hamees Inventory (Port 3009)
- **URL**: https://hamees.gagneet.com
- **PM2 Process Name**: `hamees-inventory`
- **Directory**: `/home/gagneet/hamees`
- **User**: `root`
- **Service**: `pm2-root.service`

### 2. HealthApp Next.js (Port 3002)
- **URL**: https://healthapp.gagneet.com
- **PM2 Process Name**: `healthapp-nextjs`
- **Directory**: `/home/gagneet/healthapp-nextjs`
- **User**: `gagneet`
- **Service**: `pm2-gagneet.service`

## Systemd Services

Two systemd services were created to manage PM2 process resurrection on boot:

### pm2-root.service
```ini
[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=root
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
Environment=PM2_HOME=/root/.pm2
PIDFile=/root/.pm2/pm2.pid
Restart=on-failure

ExecStart=/usr/local/lib/node_modules/pm2/bin/pm2 resurrect
ExecReload=/usr/local/lib/node_modules/pm2/bin/pm2 reload all
ExecStop=/usr/local/lib/node_modules/pm2/bin/pm2 kill

[Install]
WantedBy=multi-user.target
```

**Location**: `/etc/systemd/system/pm2-root.service`

### pm2-gagneet.service
```ini
[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=gagneet
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:/usr/local/bin:/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
Environment=PM2_HOME=/home/gagneet/.pm2
PIDFile=/home/gagneet/.pm2/pm2.pid
Restart=on-failure

ExecStart=/usr/local/lib/node_modules/pm2/bin/pm2 resurrect
ExecReload=/usr/local/lib/node_modules/pm2/bin/pm2 reload all
ExecStop=/usr/local/lib/node_modules/pm2/bin/pm2 kill

[Install]
WantedBy=multi-user.target
```

**Location**: `/etc/systemd/system/pm2-gagneet.service`

## Process Lists

PM2 maintains saved process lists that are resurrected on boot:

- **Root user**: `/root/.pm2/dump.pm2`
- **Gagneet user**: `/home/gagneet/.pm2/dump.pm2`

## Setup Commands (Already Executed)

The following commands were used to configure auto-startup:

```bash
# For gagneet user (healthapp)
sudo -u gagneet pm2 startup
sudo env PATH=$PATH:/usr/local/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u gagneet --hp /home/gagneet
sudo -u gagneet pm2 save

# For root user (hamees)
pm2 startup
pm2 save
```

## Boot Sequence

When the server reboots, the following happens automatically:

1. **Server Boots**: System starts up
2. **Network Available**: systemd waits for network.target
3. **PM2 Services Start**:
   - `pm2-gagneet.service` starts
   - `pm2-root.service` starts
4. **PM2 Resurrects Processes**:
   - Reads saved process list from dump.pm2 files
   - Starts all saved applications with original configuration
5. **Applications Available**:
   - Hamees Inventory on port 3009
   - HealthApp on port 3002
6. **Nginx Routes Traffic**: Reverse proxy makes apps publicly available

## Management Commands

### Check Service Status

```bash
# Check systemd services
systemctl status pm2-root
systemctl status pm2-gagneet

# Check enabled services
systemctl list-unit-files | grep pm2
```

### Manage PM2 Processes

```bash
# As root user (for hamees)
pm2 list
pm2 restart hamees-inventory
pm2 stop hamees-inventory
pm2 logs hamees-inventory

# As gagneet user (for healthapp)
sudo -u gagneet pm2 list
sudo -u gagneet pm2 restart healthapp-nextjs
sudo -u gagneet pm2 stop healthapp-nextjs
sudo -u gagneet pm2 logs healthapp-nextjs
```

### Save Process List After Changes

**IMPORTANT**: After starting new processes or making changes, save the process list:

```bash
# As root
pm2 save

# As gagneet
sudo -u gagneet pm2 save
```

### Restart Systemd Services

```bash
# Restart PM2 services
sudo systemctl restart pm2-root
sudo systemctl restart pm2-gagneet

# Reload systemd daemon (if service files changed)
sudo systemctl daemon-reload
```

## Verification After Reboot

After a server reboot, verify everything started correctly:

```bash
# 1. Check systemd services
systemctl status pm2-root
systemctl status pm2-gagneet

# 2. Check PM2 processes
pm2 list
sudo -u gagneet pm2 list

# 3. Check ports are listening
sudo netstat -tlnp | grep :3009  # hamees
sudo netstat -tlnp | grep :3002  # healthapp

# 4. Test public URLs
curl -I https://hamees.gagneet.com
curl -I https://healthapp.gagneet.com
```

Expected output:
- Both services: `active (running)`
- Both PM2 processes: `status: online`
- Both ports: `LISTEN` state
- Both URLs: `HTTP/2 200`

## Adding New Applications

To add a new application to auto-startup:

```bash
# 1. Start the application with PM2
pm2 start <app> --name <name>

# 2. Verify it's running
pm2 list

# 3. Save the process list
pm2 save

# The application will now auto-start on reboot
```

## Removing Applications from Auto-Startup

```bash
# 1. Stop and delete the process
pm2 stop <name>
pm2 delete <name>

# 2. Save the updated process list
pm2 save

# The application will no longer auto-start
```

## Troubleshooting

### Services Not Starting on Boot

```bash
# Check service status
sudo systemctl status pm2-root
sudo systemctl status pm2-gagneet

# Check service logs
sudo journalctl -u pm2-root -n 50
sudo journalctl -u pm2-gagneet -n 50

# Re-enable services
sudo systemctl enable pm2-root
sudo systemctl enable pm2-gagneet
```

### Processes Not Resurrecting

```bash
# Check if dump.pm2 files exist
ls -la /root/.pm2/dump.pm2
ls -la /home/gagneet/.pm2/dump.pm2

# Manually resurrect
pm2 resurrect
sudo -u gagneet pm2 resurrect

# Re-save process list
pm2 save
sudo -u gagneet pm2 save
```

### Port Already in Use After Reboot

```bash
# Find what's using the port
sudo lsof -i :3009
sudo lsof -i :3002

# Kill the process if needed
sudo kill -9 <PID>

# Restart PM2 process
pm2 restart <name>
```

### Service Fails to Start

```bash
# Check detailed error
sudo systemctl status pm2-root -l
sudo systemctl status pm2-gagneet -l

# Check PM2 logs
pm2 logs
sudo -u gagneet pm2 logs

# Restart service manually
sudo systemctl restart pm2-root
sudo systemctl restart pm2-gagneet
```

## Disabling Auto-Startup

If you need to disable auto-startup:

```bash
# Disable services
sudo systemctl disable pm2-root
sudo systemctl disable pm2-gagneet

# Or remove startup configuration entirely
pm2 unstartup systemd
sudo -u gagneet pm2 unstartup systemd
```

## Important Notes

1. **Always save after changes**: Run `pm2 save` after starting/stopping/restarting processes
2. **Service order**: Services start automatically after network is available
3. **User context**: Hamees runs as root, HealthApp runs as gagneet user
4. **Logs location**:
   - Hamees: `/home/gagneet/hamees/logs/`
   - HealthApp: `/home/gagneet/healthapp-nextjs/logs/`
5. **Process monitoring**: Both PM2 instances monitor processes and auto-restart on crash

## Configuration Date

- **Initial Setup**: January 19, 2026
- **Services Enabled**: pm2-root.service, pm2-gagneet.service
- **Applications**: hamees-inventory, healthapp-nextjs

## Related Documentation

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Systemd Service Documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- Project README files in respective directories

## Support

For issues or questions:
1. Check PM2 logs: `pm2 logs`
2. Check systemd logs: `sudo journalctl -u pm2-root`
3. Verify service status: `systemctl status pm2-root`
4. Review this documentation
