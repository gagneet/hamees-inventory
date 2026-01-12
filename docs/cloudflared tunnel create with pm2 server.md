$ cloudflared tunnel create home-server
Tunnel credentials written to /home/gagneet/.cloudflared/c66da87e-6ce4-4242-afea-8a8b3162b235.json. cloudflared chose this file based on where your origin certificate was found. Keep this file secret. To revoke these credentials, delete the tunnel.

Created tunnel home-server with id c66da87e-6ce4-4242-afea-8a8b3162b235

tunnel: c66da87e-6ce4-4242-afea-8a8b3162b235
credentials-file: /home/gagneet/.cloudflared/c66da87e-6ce4-4242-afea-8a8b3162b235.json

ingress:
  # Map your subdomains to your local Nginx (usually port 80)
  - hostname: healthapp.gagneet.com
    service: http://localhost:80
  - hostname: retirement.gagneet.com
    service: http://localhost:80
  
  # Catch-all rule (important: must be last)
  - service: http_status:404



sudo mkdir /etc/cloudflared
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/
sudo cp ~/.cloudflared/c66da87e-6ce4-4242-afea-8a8b3162b235.json /etc/cloudflared/


sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared


~/hamees$ npm run build

> tailor-inventory@0.1.0 build
> next build

▲ Next.js 16.1.1 (Turbopack)
- Environments: .env

  Creating an optimized production build ...
✓ Compiled successfully in 3.2s
✓ Finished TypeScript in 3.6s    
✓ Collecting page data using 3 workers in 395.5ms    
✓ Generating static pages using 3 workers (4/4) in 154.3ms
✓ Finalizing page optimization in 11.6ms    




tunnel: c66da87e-6ce4-4242-afea-8a8b3162b235
credentials-file: /home/gagneet/.cloudflared/c66da87e-6ce4-4242-afea-8a8b3162b235.json

ingress:
# Map all subdomains to local Nginx HTTPS (port 443)
- hostname: expenses.gagneet.com
  service: https://localhost:443
  originRequest:
    noTLSVerify: true
- hostname: firefly.gagneet.com
  service: https://localhost:443
  originRequest:
    noTLSVerify: true
- hostname: gagneet.com
  service: https://localhost:443
  originRequest:
    noTLSVerify: true
- hostname: hamees.gagneet.com
  service: https://localhost:443
  originRequest:
    noTLSVerify: true
- hostname: healthapp.gagneet.com
  service: https://localhost:443
  originRequest:
    noTLSVerify: true
- hostname: property.gagneet.com
  service: https://localhost:443
  originRequest:
    noTLSVerify: true
- hostname: retirement.gagneet.com
  service: https://localhost:443
  originRequest:
    noTLSVerify: true

# Catch-all rule (important: must be last)
- service: http_status:404




sudo -u postgres psql -c "DROP DATABASE tailor_inventory;"
sudo -u postgres psql -c "CREATE DATABASE tailor_inventory OWNER hamees_user;"
pnpm db:push
pnpm db:seed


To manage the production app, use PM2 commands:

# Restart after code changes
pm2 restart hamees-inventory

# Stop the app
pm2 stop hamees-inventory

# View logs
pm2 logs hamees-inventory

# Check status
pm2 status

If you want to run it directly (for testing):
# Stop PM2 first
pm2 stop hamees-inventory

# Then run manually
pnpm start

Your app is currently running and accessible at:
- https://hamees.gagneet.com
- http://localhost:3009