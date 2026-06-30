export const BLOG_CONTENT: Record<string, { contentEn: string; contentFa: string }> = {
  'mikrotik-ospf-multi-site': {
    contentEn: `## Overview

OSPF (Open Shortest Path First) is the go-to dynamic routing protocol for enterprise multi-site networks. This guide walks through deploying OSPF across MikroTik routers at multiple branch offices.

## Prerequisites

- MikroTik RouterOS 7.x
- Site-to-site connectivity (MPLS, VPN, or leased lines)
- IP addressing plan with /30 links between routers

## Basic OSPF Configuration

\`\`\`bash
# Enable OSPF instance on RouterOS 7
/routing ospf instance add name=main router-id=10.0.0.1

# Create OSPF area
/routing ospf area add name=backbone instance=main area-id=0.0.0.0

# Add network interfaces to OSPF
/routing ospf interface-template add area=backbone interfaces=ether1 type=ptp
/routing ospf interface-template add area=backbone interfaces=lo0 type=stub
\`\`\`

## Multi-Area Design

For larger deployments, use multiple OSPF areas to reduce LSA flooding:

- **Area 0** (Backbone): Core routers and inter-site links
- **Area 1** (Branch offices): Stub areas for branch LANs
- **Area 2** (DMZ): NSSA for internet-facing segments

\`\`\`bash
# Configure stub area for branch
/routing ospf area add name=branch1 instance=main area-id=0.0.0.1 type=stub
\`\`\`

## Route Summarization

Summarize branch prefixes at ABRs to reduce routing table size:

\`\`\`bash
/routing ospf area-range add area=branch1 prefix=192.168.10.0/23 advertise=yes
\`\`\`

## Authentication

Always enable MD5 authentication between OSPF neighbors:

\`\`\`bash
/routing ospf interface-template set [find] auth=md5 auth-key=YourSecureKey123
\`\`\`

## Verification

\`\`\`bash
/routing ospf neighbor print
/ip route print where routing-mark~"ospf"
/routing ospf lsa print
\`\`\`

## Best Practices

1. Use loopback interfaces as router-IDs for stability
2. Enable BFD for sub-second failure detection
3. Set reference bandwidth to match your fastest links
4. Document all area boundaries and summarization points
5. Test failover by physically disconnecting a link — not just shutting it down

OSPF on MikroTik is production-ready and scales well to 20+ sites. Keep your area design simple and your authentication consistent.`,

    contentFa: `## مرور کلی

OSPF (اولین مسیر کوتاه‌ترین باز) پروتکل مسیریابی پویای استاندارد برای شبکه‌های چند سایته سازمانی است. این راهنما نحوه استقرار OSPF روی روترهای MikroTik در چندین دفتر شعبه را توضیح می‌دهد.

## پیش‌نیازها

- MikroTik RouterOS نسخه ۷.x
- اتصال سایت به سایت (MPLS، VPN یا خطوط اجاره‌ای)
- طرح آدرس‌دهی IP با لینک‌های /30 بین روترها

## پیکربندی پایه OSPF

\`\`\`bash
# فعال‌سازی نمونه OSPF روی RouterOS 7
/routing ospf instance add name=main router-id=10.0.0.1

# ایجاد ناحیه OSPF
/routing ospf area add name=backbone instance=main area-id=0.0.0.0

# افزودن رابط‌های شبکه به OSPF
/routing ospf interface-template add area=backbone interfaces=ether1 type=ptp
/routing ospf interface-template add area=backbone interfaces=lo0 type=stub
\`\`\`

## طراحی چند ناحیه‌ای

برای استقرارهای بزرگ‌تر، از چندین ناحیه OSPF برای کاهش flooding LSA استفاده کنید:

- **ناحیه ۰** (Backbone): روترهای هسته و لینک‌های بین سایتی
- **ناحیه ۱** (دفاتر شعبه): نواحی Stub برای LAN‌های شعبه
- **ناحیه ۲** (DMZ): NSSA برای بخش‌های مواجه با اینترنت

## خلاصه‌سازی مسیر

پیشوندهای شعبه را در ABR‌ها خلاصه کنید تا اندازه جدول مسیریابی کاهش یابد:

\`\`\`bash
/routing ospf area-range add area=branch1 prefix=192.168.10.0/23 advertise=yes
\`\`\`

## احراز هویت

همیشه احراز هویت MD5 را بین همسایگان OSPF فعال کنید:

\`\`\`bash
/routing ospf interface-template set [find] auth=md5 auth-key=YourSecureKey123
\`\`\`

## تأیید

\`\`\`bash
/routing ospf neighbor print
/ip route print where routing-mark~"ospf"
/routing ospf lsa print
\`\`\`

## بهترین شیوه‌ها

۱. از رابط‌های loopback به عنوان router-ID برای پایداری استفاده کنید
۲. BFD را برای تشخیص خرابی زیر یک ثانیه فعال کنید
۳. پهنای باند مرجع را مطابق سریع‌ترین لینک‌هایتان تنظیم کنید
۴. تمام مرزهای ناحیه و نقاط خلاصه‌سازی را مستند کنید
۵. Failover را با جداکردن فیزیکی یک لینک آزمایش کنید — نه فقط خاموش کردن آن`,
  },

  'mikrotik-vlan-segmentation': {
    contentEn: `## Why VLAN Segmentation Matters

Network segmentation isolates traffic between departments, devices, and security zones. On MikroTik, bridge-based VLANs with hardware offloading deliver wire-speed performance.

## Bridge VLAN Filtering Setup

\`\`\`bash
# Create bridge with VLAN filtering
/interface bridge add name=br1 vlan-filtering=yes

# Add ports to bridge
/interface bridge port add bridge=br1 interface=ether2 pvid=10
/interface bridge port add bridge=br1 interface=ether3 pvid=20
/interface bridge port add bridge=br1 interface=ether4 pvid=30

# Add trunk port (uplink)
/interface bridge port add bridge=br1 interface=ether1 pvid=1

# Configure VLAN table
/interface bridge vlan add bridge=br1 vlan-ids=10 tagged=ether1 untagged=ether2
/interface bridge vlan add bridge=br1 vlan-ids=20 tagged=ether1 untagged=ether3
/interface bridge vlan add bridge=br1 vlan-ids=30 tagged=ether1 untagged=ether4
\`\`\`

## Inter-VLAN Routing

Create VLAN interfaces on the router for inter-VLAN routing:

\`\`\`bash
/interface vlan add interface=br1 name=vlan10 vlan-id=10
/interface vlan add interface=br1 name=vlan20 vlan-id=20
/interface vlan add interface=br1 name=vlan30 vlan-id=30

/ip address add address=192.168.10.1/24 interface=vlan10
/ip address add address=192.168.20.1/24 interface=vlan20
/ip address add address=192.168.30.1/24 interface=vlan30
\`\`\`

## DHCP per VLAN

\`\`\`bash
/ip pool add name=pool10 ranges=192.168.10.100-192.168.10.200
/ip dhcp-server add name=dhcp10 interface=vlan10 address-pool=pool10
/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=8.8.8.8
\`\`\`

## Firewall Rules for VLAN Isolation

\`\`\`bash
# Block inter-VLAN by default, allow specific traffic
/ip firewall filter add chain=forward in-interface=vlan10 out-interface=vlan20 action=drop comment="Block staff to guest"
/ip firewall filter add chain=forward in-interface=vlan30 action=drop comment="Block POS from internet"
\`\`\`

## Common VLAN Design

| VLAN | Purpose | Subnet |
|------|---------|--------|
| 10 | Staff | 192.168.10.0/24 |
| 20 | Guest WiFi | 192.168.20.0/24 |
| 30 | POS / IoT | 192.168.30.0/24 |
| 99 | Management | 10.99.0.0/24 |

Always put management on a dedicated VLAN with strict ACLs.`,

    contentFa: `## چرا تقسیم‌بندی VLAN اهمیت دارد

تقسیم‌بندی شبکه ترافیک بین بخش‌ها، دستگاه‌ها و مناطق امنیتی را جدا می‌کند. در MikroTik، VLAN‌های مبتنی بر Bridge با Hardware Offloading، عملکرد wire-speed ارائه می‌دهند.

## راه‌اندازی Bridge VLAN Filtering

\`\`\`bash
# ایجاد Bridge با فیلترینگ VLAN
/interface bridge add name=br1 vlan-filtering=yes

# افزودن پورت‌ها به Bridge
/interface bridge port add bridge=br1 interface=ether2 pvid=10
/interface bridge port add bridge=br1 interface=ether3 pvid=20
/interface bridge port add bridge=br1 interface=ether4 pvid=30

# افزودن پورت Trunk (آپلینک)
/interface bridge port add bridge=br1 interface=ether1 pvid=1

# پیکربندی جدول VLAN
/interface bridge vlan add bridge=br1 vlan-ids=10 tagged=ether1 untagged=ether2
/interface bridge vlan add bridge=br1 vlan-ids=20 tagged=ether1 untagged=ether3
/interface bridge vlan add bridge=br1 vlan-ids=30 tagged=ether1 untagged=ether4
\`\`\`

## مسیریابی بین VLAN

رابط‌های VLAN را روی روتر برای مسیریابی بین VLAN ایجاد کنید:

\`\`\`bash
/interface vlan add interface=br1 name=vlan10 vlan-id=10
/interface vlan add interface=br1 name=vlan20 vlan-id=20
/interface vlan add interface=br1 name=vlan30 vlan-id=30

/ip address add address=192.168.10.1/24 interface=vlan10
/ip address add address=192.168.20.1/24 interface=vlan20
/ip address add address=192.168.30.1/24 interface=vlan30
\`\`\`

## DHCP برای هر VLAN

\`\`\`bash
/ip pool add name=pool10 ranges=192.168.10.100-192.168.10.200
/ip dhcp-server add name=dhcp10 interface=vlan10 address-pool=pool10
/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=8.8.8.8
\`\`\`

## قوانین فایروال برای ایزولاسیون VLAN

\`\`\`bash
# مسدود کردن بین VLAN به‌صورت پیش‌فرض
/ip firewall filter add chain=forward in-interface=vlan10 out-interface=vlan20 action=drop comment="بلاک کارمند به مهمان"
/ip firewall filter add chain=forward in-interface=vlan30 action=drop comment="بلاک POS از اینترنت"
\`\`\`

## طراحی رایج VLAN

| VLAN | کاربرد | زیرشبکه |
|------|---------|--------|
| ۱۰ | کارمندان | 192.168.10.0/24 |
| ۲۰ | WiFi مهمان | 192.168.20.0/24 |
| ۳۰ | POS / IoT | 192.168.30.0/24 |
| ۹۹ | مدیریت | 10.99.0.0/24 |

همیشه مدیریت را روی یک VLAN اختصاصی با ACL‌های سختگیرانه قرار دهید.`,
  },

  'mikrotik-ipsec-vpn': {
    contentEn: `## IPSec IKEv2 Site-to-Site VPN on MikroTik

IPSec with IKEv2 provides strong encryption and fast renegotiation. This guide configures a tunnel between two MikroTik routers.

## Site A Configuration (HQ)

\`\`\`bash
# IKEv2 Proposal
/ip ipsec proposal add name=ike2-prop auth-algorithms=sha256 enc-algorithms=aes-256-cbc pfs-group=modp2048

# Peer (Site B's public IP)
/ip ipsec peer add name=site-b address=203.0.113.2/32 exchange-mode=ike2

# Identity
/ip ipsec identity add peer=site-b auth-method=pre-shared-key secret=VeryStr0ngPresharedKey

# Policy (encrypt traffic between subnets)
/ip ipsec policy add peer=site-b tunnel=yes sa-src-address=198.51.100.1 sa-dst-address=203.0.113.2 src-address=10.1.0.0/24 dst-address=10.2.0.0/24 proposal=ike2-prop
\`\`\`

## Site B Configuration (Branch)

Mirror the configuration with swapped addresses:

\`\`\`bash
/ip ipsec peer add name=site-a address=198.51.100.1/32 exchange-mode=ike2
/ip ipsec identity add peer=site-a auth-method=pre-shared-key secret=VeryStr0ngPresharedKey
/ip ipsec policy add peer=site-a tunnel=yes sa-src-address=203.0.113.2 sa-dst-address=198.51.100.1 src-address=10.2.0.0/24 dst-address=10.1.0.0/24 proposal=ike2-prop
\`\`\`

## Firewall: Allow IPSec Traffic

\`\`\`bash
/ip firewall filter add chain=input protocol=udp dst-port=500,4500 action=accept comment="IKEv2"
/ip firewall filter add chain=input protocol=ipsec-esp action=accept comment="IPSec ESP"
/ip firewall raw add chain=prerouting in-interface=ether1 ipsec-policy=in,ipsec action=notrack
\`\`\`

## Verification

\`\`\`bash
/ip ipsec active-peers print
/ip ipsec installed-sa print
/ip ipsec statistics print
\`\`\`

## Troubleshooting

- **No SA established**: Check pre-shared key matches exactly (case-sensitive)
- **Phase 1 fails**: Verify encryption/hash algorithms match on both sides
- **Traffic not encrypting**: Check policy src/dst addresses and route to tunnel

## Dead Peer Detection

\`\`\`bash
/ip ipsec peer set [find name=site-b] dpd-interval=30s dpd-maximum-failures=5
\`\`\`

Use DPD to detect and recover from dead tunnels automatically.`,

    contentFa: `## VPN IPSec IKEv2 سایت به سایت روی MikroTik

IPSec با IKEv2 رمزگذاری قوی و مذاکره مجدد سریع فراهم می‌کند. این راهنما یک تانل بین دو روتر MikroTik پیکربندی می‌کند.

## پیکربندی سایت A (مرکز)

\`\`\`bash
# پروپوزال IKEv2
/ip ipsec proposal add name=ike2-prop auth-algorithms=sha256 enc-algorithms=aes-256-cbc pfs-group=modp2048

# Peer (آدرس عمومی سایت B)
/ip ipsec peer add name=site-b address=203.0.113.2/32 exchange-mode=ike2

# هویت
/ip ipsec identity add peer=site-b auth-method=pre-shared-key secret=VeryStr0ngPresharedKey

# پالیسی (رمزگذاری ترافیک بین زیرشبکه‌ها)
/ip ipsec policy add peer=site-b tunnel=yes sa-src-address=198.51.100.1 sa-dst-address=203.0.113.2 src-address=10.1.0.0/24 dst-address=10.2.0.0/24 proposal=ike2-prop
\`\`\`

## پیکربندی سایت B (شعبه)

پیکربندی را با آدرس‌های جابجا شده آینه کنید:

\`\`\`bash
/ip ipsec peer add name=site-a address=198.51.100.1/32 exchange-mode=ike2
/ip ipsec identity add peer=site-a auth-method=pre-shared-key secret=VeryStr0ngPresharedKey
/ip ipsec policy add peer=site-a tunnel=yes sa-src-address=203.0.113.2 sa-dst-address=198.51.100.1 src-address=10.2.0.0/24 dst-address=10.1.0.0/24 proposal=ike2-prop
\`\`\`

## فایروال: اجازه به ترافیک IPSec

\`\`\`bash
/ip firewall filter add chain=input protocol=udp dst-port=500,4500 action=accept comment="IKEv2"
/ip firewall filter add chain=input protocol=ipsec-esp action=accept comment="IPSec ESP"
\`\`\`

## تأیید

\`\`\`bash
/ip ipsec active-peers print
/ip ipsec installed-sa print
/ip ipsec statistics print
\`\`\`

## رفع اشکال

- **SA ایجاد نشد**: بررسی کنید کلید پیش‌اشتراکی دقیقاً یکسان باشد (حساس به حروف بزرگ/کوچک)
- **فاز ۱ ناموفق**: الگوریتم‌های رمزگذاری/هش را در هر دو طرف تأیید کنید
- **ترافیک رمزگذاری نمی‌شود**: آدرس‌های src/dst پالیسی و مسیر تانل را بررسی کنید

## Dead Peer Detection

\`\`\`bash
/ip ipsec peer set [find name=site-b] dpd-interval=30s dpd-maximum-failures=5
\`\`\`

از DPD برای تشخیص و بازیابی خودکار از تانل‌های مرده استفاده کنید.`,
  },

  'zero-trust-fortigate': {
    contentEn: `## Zero-Trust with Fortigate NGFW

Zero-trust means: never trust, always verify. Every connection — even internal — must authenticate and be authorized explicitly.

## Core Principles

1. **Verify explicitly**: Authenticate every user and device
2. **Least privilege**: Grant minimum required access
3. **Assume breach**: Segment networks; limit blast radius

## Fortigate SSL Deep Inspection

\`\`\`
config firewall ssl-ssh-profile
    edit "deep-inspection"
        set comment "Enterprise SSL inspection"
        config ssl
            set inspect-all deep-inspection
        end
        config https
            set ports 443
            set status deep-inspection
        end
    next
end
\`\`\`

## Application Control + IPS

\`\`\`
config firewall policy
    edit 100
        set name "ZeroTrust-Outbound"
        set srcintf "internal"
        set dstintf "wan1"
        set srcaddr "Corp-Users"
        set dstaddr "all"
        set action accept
        set schedule "always"
        set service "ALL"
        set ssl-ssh-profile "deep-inspection"
        set application-list "Enterprise-AppCtrl"
        set ips-sensor "Enterprise-IPS"
        set logtraffic all
    next
end
\`\`\`

## Micro-Segmentation with Security Zones

Create separate security zones for each network segment:

- **ZONE-CORP**: Corporate workstations
- **ZONE-SERVER**: Server farm
- **ZONE-POS**: Point of Sale devices
- **ZONE-IOT**: IoT and printer network
- **ZONE-GUEST**: Guest WiFi

Explicit deny rules between zones; only allow documented flows.

## FortiAuthenticator + MFA

Integrate FortiAuthenticator for 2FA on all VPN and admin access:

\`\`\`
config user radius
    edit "FortiAuth"
        set server 10.0.0.10
        set secret RadiusSecret
        set auth-type ms_chap_v2
    next
end
\`\`\`

## Continuous Monitoring

- Enable FortiAnalyzer log aggregation
- Set up threat dashboards per zone
- Alert on lateral movement patterns
- Weekly policy review cycle

Zero-trust is a journey, not a product. Start with segmentation, add MFA, and iterate.`,

    contentFa: `## Zero-Trust با Fortigate NGFW

Zero-trust یعنی: هرگز اعتماد نکن، همیشه تأیید کن. هر اتصال — حتی داخلی — باید احراز هویت شده و صریحاً مجاز باشد.

## اصول اساسی

۱. **تأیید صریح**: هر کاربر و دستگاه را احراز هویت کنید
۲. **حداقل امتیاز**: حداقل دسترسی مورد نیاز را اعطا کنید
۳. **فرض نقض امنیت**: شبکه‌ها را تقسیم‌بندی کنید؛ شعاع انفجار را محدود کنید

## بازرسی SSL عمیق Fortigate

\`\`\`
config firewall ssl-ssh-profile
    edit "deep-inspection"
        set comment "بازرسی SSL سازمانی"
        config https
            set ports 443
            set status deep-inspection
        end
    next
end
\`\`\`

## کنترل برنامه + IPS

\`\`\`
config firewall policy
    edit 100
        set name "ZeroTrust-Outbound"
        set srcintf "internal"
        set dstintf "wan1"
        set action accept
        set ssl-ssh-profile "deep-inspection"
        set application-list "Enterprise-AppCtrl"
        set ips-sensor "Enterprise-IPS"
        set logtraffic all
    next
end
\`\`\`

## میکرو-تقسیم‌بندی با مناطق امنیتی

مناطق امنیتی جداگانه برای هر بخش شبکه ایجاد کنید:

- **ZONE-CORP**: ایستگاه‌های کاری سازمانی
- **ZONE-SERVER**: مزرعه سرور
- **ZONE-POS**: دستگاه‌های نقطه فروش
- **ZONE-IOT**: شبکه IoT و چاپگر
- **ZONE-GUEST**: WiFi مهمان

قوانین رد صریح بین مناطق؛ فقط جریان‌های مستند را اجازه دهید.

## FortiAuthenticator + MFA

FortiAuthenticator را برای احراز هویت دوعاملی روی تمام VPN و دسترسی مدیریتی یکپارچه کنید.

## پایش مداوم

- تجمیع لاگ FortiAnalyzer را فعال کنید
- داشبوردهای تهدید را برای هر منطقه راه‌اندازی کنید
- روی الگوهای حرکت جانبی هشدار تنظیم کنید
- چرخه بازبینی پالیسی هفتگی

Zero-trust یک سفر است، نه یک محصول. با تقسیم‌بندی شروع کنید، MFA اضافه کنید، و تکرار کنید.`,
  },

  'network-penetration-testing-basics': {
    contentEn: `## Introduction to Network Penetration Testing

Penetration testing simulates real attacks to find vulnerabilities before malicious actors do. This guide covers the methodology and key tools.

## Methodology: The 5 Phases

1. **Reconnaissance**: Gather information passively
2. **Scanning**: Discover live hosts and open ports
3. **Enumeration**: Extract service versions and users
4. **Exploitation**: Attempt to compromise systems
5. **Reporting**: Document findings and remediation

## Phase 1: Reconnaissance

\`\`\`bash
# Passive recon - OSINT
whois target.com
dig target.com ANY
nslookup -type=mx target.com

# Subdomain enumeration
subfinder -d target.com -o subdomains.txt
\`\`\`

## Phase 2: Network Scanning with Nmap

\`\`\`bash
# Host discovery
nmap -sn 192.168.1.0/24

# Full port scan with version detection
nmap -sV -sC -p- --min-rate 1000 192.168.1.10 -oN scan.txt

# UDP scan (slower but important)
nmap -sU --top-ports 100 192.168.1.10
\`\`\`

## Phase 3: Service Enumeration

\`\`\`bash
# SMB enumeration
enum4linux -a 192.168.1.10
smbclient -L //192.168.1.10 -N

# SNMP enumeration
snmpwalk -v2c -c public 192.168.1.1
onesixtyone -c community.txt 192.168.1.0/24
\`\`\`

## Phase 4: Exploitation with Metasploit

\`\`\`bash
msfconsole
msf6 > search eternalblue
msf6 > use exploit/windows/smb/ms17_010_eternalblue
msf6 exploit > set RHOSTS 192.168.1.10
msf6 exploit > run
\`\`\`

## Common Network Vulnerabilities

- Default credentials on network devices
- Unpatched firmware (MikroTik, Cisco, Fortigate)
- SNMP community string "public"
- Open Telnet/FTP instead of SSH/SFTP
- Flat networks with no segmentation

## Reporting

Always document: scope, methodology, findings (with severity), proof-of-concept, and remediation recommendations. Never exploit production systems without written authorization.`,

    contentFa: `## مقدمه‌ای بر تست نفوذ شبکه

تست نفوذ حملات واقعی را برای یافتن آسیب‌پذیری‌ها قبل از بازیگران مخرب شبیه‌سازی می‌کند. این راهنما متدولوژی و ابزارهای کلیدی را پوشش می‌دهد.

## متدولوژی: ۵ مرحله

۱. **شناسایی**: جمع‌آوری اطلاعات به‌صورت غیرفعال
۲. **اسکن**: کشف هاست‌های فعال و پورت‌های باز
۳. **شمارش**: استخراج نسخه‌های سرویس و کاربران
۴. **بهره‌برداری**: تلاش برای به خطر انداختن سیستم‌ها
۵. **گزارش**: مستندسازی یافته‌ها و اقدامات اصلاحی

## مرحله ۲: اسکن شبکه با Nmap

\`\`\`bash
# کشف هاست
nmap -sn 192.168.1.0/24

# اسکن کامل پورت با تشخیص نسخه
nmap -sV -sC -p- --min-rate 1000 192.168.1.10 -oN scan.txt

# اسکن UDP (کندتر اما مهم)
nmap -sU --top-ports 100 192.168.1.10
\`\`\`

## مرحله ۳: شمارش سرویس

\`\`\`bash
# شمارش SMB
enum4linux -a 192.168.1.10
smbclient -L //192.168.1.10 -N

# شمارش SNMP
snmpwalk -v2c -c public 192.168.1.1
\`\`\`

## مرحله ۴: بهره‌برداری با Metasploit

\`\`\`bash
msfconsole
msf6 > search eternalblue
msf6 > use exploit/windows/smb/ms17_010_eternalblue
msf6 exploit > set RHOSTS 192.168.1.10
msf6 exploit > run
\`\`\`

## آسیب‌پذیری‌های رایج شبکه

- اعتبارنامه‌های پیش‌فرض روی تجهیزات شبکه
- فریم‌ور وصله‌نشده (MikroTik، Cisco، Fortigate)
- رشته Community SNMP «public»
- Telnet/FTP باز به جای SSH/SFTP
- شبکه‌های تخت بدون تقسیم‌بندی

## گزارش

همیشه مستند کنید: محدوده، متدولوژی، یافته‌ها (با شدت)، اثبات مفهوم، و توصیه‌های اصلاحی. هرگز بدون مجوز کتبی سیستم‌های تولیدی را بهره‌برداری نکنید.`,
  },

  'firewall-policy-best-practices': {
    contentEn: `## Enterprise Firewall Policy Design

Poor firewall policies are the #1 cause of security incidents. This guide covers design principles that work at enterprise scale.

## The Golden Rules

1. **Default deny**: Block everything, whitelist what's needed
2. **Rule ordering matters**: First match wins — put specific rules before general
3. **Name every rule**: "allow-web-servers-to-db" beats "rule-47"
4. **Log everything you block** (and sample what you allow)
5. **Review quarterly**: Dead rules accumulate; clean them out

## Rule Structure Template

\`\`\`
Rule Name: [ZONE-SRC]-to-[ZONE-DST]-[SERVICE]
Source: Specific IP/group (not "any")
Destination: Specific IP/group (not "any")
Service: Named service object (not port number)
Action: Accept | Deny
Log: Yes (always on deny; on accept for sensitive)
\`\`\`

## Zone-Based Architecture

\`\`\`
Internet → [Fortigate/Firewall]
                |
    ┌───────────┼───────────┐
    ▼           ▼           ▼
  DMZ         CORP        SERVER
(Web/Mail)  (Staff)    (DB/App)
\`\`\`

Traffic flows:
- Internet → DMZ: Only ports 80/443 to web servers
- DMZ → CORP: Never
- CORP → SERVER: Only needed ports (1433 for SQL, etc.)
- CORP → Internet: HTTP/HTTPS via proxy, deny all else

## Fortigate Policy Example

\`\`\`
Policy: CORP-to-SERVER-SQL
Source Zone: CORP
Destination Zone: SERVER
Source: Corp-Workstations (address group)
Destination: SQL-Servers (address group)
Service: MS-SQL (TCP/1433)
Action: Accept
Log: All Sessions
IPS: Enable
\`\`\`

## Common Mistakes

- "Any-any" rules left from initial setup
- Overlapping rules causing unintended allow
- No logging = no forensics when incidents happen
- Missing egress filtering (attackers love this)
- Not testing after changes

## Quarterly Cleanup Checklist

- [ ] Remove rules with zero hit count > 90 days
- [ ] Verify all address objects still exist
- [ ] Check for shadow rules (rules that never match)
- [ ] Review admin access rules
- [ ] Update documentation`,

    contentFa: `## طراحی پالیسی فایروال سازمانی

پالیسی‌های ضعیف فایروال دلیل شماره ۱ حوادث امنیتی هستند. این راهنما اصول طراحی که در مقیاس سازمانی کار می‌کنند را پوشش می‌دهد.

## قوانین طلایی

۱. **رد پیش‌فرض**: همه چیز را مسدود کنید، آنچه نیاز است را Whitelist کنید
۲. **ترتیب قوانین اهمیت دارد**: اولین تطابق برنده می‌شود — قوانین خاص را قبل از عمومی قرار دهید
۳. **هر قانون را نام‌گذاری کنید**: «allow-web-servers-to-db» بهتر از «rule-47» است
۴. **همه چیزی که مسدود می‌کنید را لاگ بگیرید**
۵. **بازبینی فصلی**: قوانین مرده تجمع می‌یابند؛ آن‌ها را پاک کنید

## قالب ساختار قانون

\`\`\`
نام قانون: [ZONE-SRC]-to-[ZONE-DST]-[SERVICE]
منبع: IP/گروه خاص (نه «any»)
مقصد: IP/گروه خاص (نه «any»)
سرویس: شیء سرویس نام‌گذاری‌شده (نه شماره پورت)
عملکرد: Accept | Deny
لاگ: بله (همیشه روی Deny؛ روی Accept برای حساس)
\`\`\`

## معماری مبتنی بر منطقه

\`\`\`
اینترنت → [Fortigate/فایروال]
                |
    ┌───────────┼───────────┐
    ▼           ▼           ▼
  DMZ          CORP        SERVER
(وب/ایمیل)   (کارمندان)  (DB/App)
\`\`\`

جریان‌های ترافیک:
- اینترنت → DMZ: فقط پورت‌های ۸۰/۴۴۳ به وب سرورها
- DMZ → CORP: هرگز
- CORP → SERVER: فقط پورت‌های مورد نیاز
- CORP → اینترنت: HTTP/HTTPS از طریق Proxy، رد همه موارد دیگر

## اشتباهات رایج

- قوانین «any-any» باقی‌مانده از راه‌اندازی اولیه
- قوانین همپوشانی که باعث اجازه ناخواسته می‌شوند
- بدون لاگ = بدون پزشکی قانونی هنگام حوادث
- فیلترینگ Egress گم‌شده (مهاجمان این را دوست دارند)

## چک‌لیست پاکسازی فصلی

- [ ] حذف قوانین با تعداد Hit صفر > ۹۰ روز
- [ ] تأیید وجود تمام اشیاء آدرس
- [ ] بررسی قوانین Shadow (قوانینی که هرگز تطابق پیدا نمی‌کنند)
- [ ] بازبینی قوانین دسترسی مدیریتی
- [ ] به‌روزرسانی مستندات`,
  },

  'proxmox-cluster-production': {
    contentEn: `## Building a Production Proxmox VE Cluster

A 3-node Proxmox cluster with Ceph storage provides full HA with no single point of failure. Here's how to build it right.

## Hardware Requirements

- 3× servers (identical specs recommended)
- 2× 10GbE NICs per server (one for cluster, one for Ceph/storage)
- NVMe SSDs for Ceph OSDs (HDDs work but slower)
- Dedicated management NIC

## Network Design

| Network | Purpose | Speed |
|---------|---------|-------|
| corosync | Cluster heartbeat | 1GbE dedicated |
| ceph-pub | Ceph public network | 10GbE |
| ceph-cluster | Ceph replication | 10GbE separate |
| vmbr0 | VM traffic | 10GbE |

## Corosync Configuration

\`\`\`bash
# /etc/pve/corosync.conf — set on first node, auto-synced
totem {
    version: 2
    cluster_name: prod-cluster
    transport: knet
    interface {
        linknumber: 0
        bindnetaddr: 10.10.10.0
        mcastport: 5405
    }
}
\`\`\`

## Initialize Ceph

\`\`\`bash
# Run on each node
pveceph init --network 10.20.20.0/24

# Create monitors on all 3 nodes
pveceph mon create

# Add OSDs (one per disk per node)
pveceph osd create /dev/nvme0n1

# Create Ceph pool for VMs
pveceph pool create vm-pool --size 3 --min-size 2

# Add pool as Proxmox storage
pvesm add rbd vm-ceph --pool vm-pool --content images,rootdir
\`\`\`

## HA Configuration

\`\`\`bash
# Create HA group
ha-manager groupadd production --nodes pve1,pve2,pve3

# Add VMs to HA
ha-manager add vm:100 --group production --max-restart 3
\`\`\`

## Live Migration Test

\`\`\`bash
# Migrate VM between nodes (zero downtime)
qm migrate 100 pve2 --online
\`\`\`

## Monitoring

Install Prometheus + Grafana with the Proxmox exporter:

\`\`\`bash
apt install prometheus-pve-exporter
\`\`\`

Key metrics: CPU/RAM per node, Ceph health, OSD latency, VM counts.

## Common Issues

- **Split-brain**: Always use odd number of nodes (3, 5, 7)
- **Ceph slow**: Check OSD latency; NVMe dramatically improves it
- **HA storm**: Set restart delays to prevent cascading failures`,

    contentFa: `## ساخت کلاستر Proxmox VE تولیدی

یک کلاستر ۳ نودی Proxmox با ذخیره‌سازی Ceph HA کامل بدون نقطه شکست واحد فراهم می‌کند.

## نیازمندی‌های سخت‌افزاری

- ۳× سرور (مشخصات یکسان توصیه می‌شود)
- ۲× کارت شبکه ۱۰GbE در هر سرور (یکی برای کلاستر، یکی برای Ceph/ذخیره‌سازی)
- NVMe SSD برای OSD‌های Ceph
- کارت شبکه مدیریتی اختصاصی

## طراحی شبکه

| شبکه | کاربرد | سرعت |
|---------|---------|-------|
| corosync | ضربان قلب کلاستر | 1GbE اختصاصی |
| ceph-pub | شبکه عمومی Ceph | 10GbE |
| ceph-cluster | Replication Ceph | 10GbE جداگانه |
| vmbr0 | ترافیک VM | 10GbE |

## راه‌اندازی Ceph

\`\`\`bash
# اجرا روی هر نود
pveceph init --network 10.20.20.0/24

# ایجاد Monitor روی هر ۳ نود
pveceph mon create

# افزودن OSD (یکی در هر دیسک در هر نود)
pveceph osd create /dev/nvme0n1

# ایجاد Pool Ceph برای VM‌ها
pveceph pool create vm-pool --size 3 --min-size 2
\`\`\`

## پیکربندی HA

\`\`\`bash
# ایجاد گروه HA
ha-manager groupadd production --nodes pve1,pve2,pve3

# افزودن VM‌ها به HA
ha-manager add vm:100 --group production --max-restart 3
\`\`\`

## تست Live Migration

\`\`\`bash
# انتقال VM بین نودها (بدون توقف)
qm migrate 100 pve2 --online
\`\`\`

## مشکلات رایج

- **Split-brain**: همیشه از تعداد فرد نود استفاده کنید (۳، ۵، ۷)
- **Ceph کند**: تأخیر OSD را بررسی کنید؛ NVMe آن را به‌طور چشمگیری بهبود می‌بخشد
- **HA storm**: تأخیرهای راه‌اندازی مجدد را تنظیم کنید تا از خرابی‌های آبشاری جلوگیری شود`,
  },

  'proxmox-backup-server': {
    contentEn: `## Proxmox Backup Server Setup

PBS (Proxmox Backup Server) is a purpose-built backup solution with deduplication, encryption, and verify-by-default.

## Installation

Deploy PBS on a dedicated server (physical or VM, separate from the cluster):

\`\`\`bash
# Add PBS repo
echo "deb http://download.proxmox.com/debian/pbs bookworm pbs-no-subscription" > /etc/apt/sources.list.d/pbs.list
apt update && apt install proxmox-backup-server
\`\`\`

## Create Datastore

\`\`\`bash
# Via CLI
proxmox-backup-manager datastore create vm-backups /mnt/backup-disk

# Set retention policy
proxmox-backup-manager datastore update vm-backups \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6
\`\`\`

## Add PBS to Proxmox Cluster

In Proxmox GUI: Datacenter → Storage → Add → Proxmox Backup Server

\`\`\`
Server: 10.0.0.20
Datastore: vm-backups
Fingerprint: (from PBS dashboard)
\`\`\`

## Backup Jobs

\`\`\`bash
# Via Proxmox GUI: VM → Backup → Add backup job
# Or CLI:
vzdump 100 101 102 --storage pbs-backup --mode snapshot --compress zstd --node pve1
\`\`\`

## Deduplication Performance

PBS stores incremental, deduplicated chunks. A 50GB VM backup might only use 2GB on PBS after the first full backup. Deduplication ratio commonly reaches 5:1 to 20:1 on similar VMs.

## Encryption

\`\`\`bash
# Generate encryption key on client
proxmox-backup-client key create /etc/pve/priv/pbs-enc.key

# Backup with encryption
vzdump 100 --storage pbs-backup --encrypt --keyfile /etc/pve/priv/pbs-enc.key
\`\`\`

## Verify Backups

PBS auto-verifies backups. Manual verification:

\`\`\`bash
proxmox-backup-client verify --repository admin@pbs!token@10.0.0.20:vm-backups
\`\`\`

## Disaster Recovery Test

Monthly test: restore a VM to an isolated network, boot it, verify services work. An untested backup is not a backup.`,

    contentFa: `## راه‌اندازی Proxmox Backup Server

PBS یک راه‌حل پشتیبان‌گیری اختصاصی با Deduplication، رمزگذاری و تأیید خودکار است.

## نصب

PBS را روی یک سرور اختصاصی (فیزیکی یا VM، جدا از کلاستر) استقرار دهید:

\`\`\`bash
echo "deb http://download.proxmox.com/debian/pbs bookworm pbs-no-subscription" > /etc/apt/sources.list.d/pbs.list
apt update && apt install proxmox-backup-server
\`\`\`

## ایجاد Datastore

\`\`\`bash
proxmox-backup-manager datastore create vm-backups /mnt/backup-disk

# تنظیم پالیسی نگهداری
proxmox-backup-manager datastore update vm-backups \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6
\`\`\`

## افزودن PBS به کلاستر Proxmox

در GUI Proxmox: Datacenter → Storage → Add → Proxmox Backup Server

## عملکرد Deduplication

PBS تکه‌های افزایشی و deduplicated ذخیره می‌کند. یک پشتیبان VM 50 گیگابایتی ممکن است پس از اولین پشتیبان کامل فقط ۲ گیگابایت روی PBS استفاده کند. نسبت Deduplication معمولاً ۵:۱ تا ۲۰:۱ در VM‌های مشابه می‌رسد.

## رمزگذاری

\`\`\`bash
# تولید کلید رمزگذاری روی کلاینت
proxmox-backup-client key create /etc/pve/priv/pbs-enc.key

# پشتیبان‌گیری با رمزگذاری
vzdump 100 --storage pbs-backup --encrypt --keyfile /etc/pve/priv/pbs-enc.key
\`\`\`

## تست بازیابی فاجعه

آزمایش ماهانه: یک VM را به یک شبکه ایزوله بازیابی کنید، آن را بوت کنید، تأیید کنید سرویس‌ها کار می‌کنند. یک پشتیبان آزمایش‌نشده پشتیبان نیست.`,
  },

  'zabbix-custom-dashboards': {
    contentEn: `## Zabbix 7.0 Custom Dashboards

Zabbix 7.0 introduced a completely redesigned dashboard engine with widget-based layouts and shared dashboards.

## Installation (Ubuntu 22.04)

\`\`\`bash
wget https://repo.zabbix.com/zabbix/7.0/ubuntu/pool/main/z/zabbix-release/zabbix-release_7.0-1+ubuntu22.04_all.deb
dpkg -i zabbix-release_7.0-1+ubuntu22.04_all.deb
apt update
apt install zabbix-server-mysql zabbix-frontend-php zabbix-nginx-conf zabbix-sql-scripts zabbix-agent2
\`\`\`

## Custom Item Types

\`\`\`
# SNMP item for MikroTik CPU
Type: SNMP agent
OID: .1.3.6.1.4.1.14988.1.1.3.14.0
Key: mikrotik.cpu.load
Type of information: Numeric (float)
Update interval: 60s
\`\`\`

## Create Network Dashboard

**Essential widgets for network monitoring:**

1. **Graph widget**: Bandwidth per interface (last 24h)
2. **Gauge widget**: CPU utilization % (color thresholds: green<60, yellow<80, red>80)
3. **Top hosts**: Hosts by traffic or CPU
4. **Map widget**: Network topology with live status
5. **Problem widget**: Active alerts by severity

## Custom Template via API

\`\`\`python
import requests

zabbix_url = "http://zabbix.local/api_jsonrpc.php"

# Authenticate
auth = requests.post(zabbix_url, json={
    "jsonrpc": "2.0",
    "method": "user.login",
    "params": {"username": "Admin", "password": "zabbix"},
    "id": 1
}).json()["result"]

# Create item
requests.post(zabbix_url, json={
    "jsonrpc": "2.0",
    "method": "item.create",
    "params": {
        "name": "Interface {#IFNAME} — In traffic",
        "key_": "net.if.in[{#IFNAME}]",
        "hostid": "10001",
        "type": 0,
        "value_type": 3,
        "delay": "60s"
    },
    "auth": auth,
    "id": 2
})
\`\`\`

## Grafana Integration

\`\`\`bash
# Install Grafana Zabbix plugin
grafana-cli plugins install alexanderzobnin-zabbix-app

# Configure data source in Grafana
# URL: http://zabbix.local/api_jsonrpc.php
# Username: zabbix-readonly
\`\`\`

## Alert Escalation

Configure multi-level escalation: 1st notify on-call → 15min → notify team lead → 30min → notify manager.`,

    contentFa: `## داشبوردهای اختصاصی Zabbix 7.0

Zabbix 7.0 موتور داشبورد کاملاً طراحی‌شده مجدد با چیدمان‌های مبتنی بر Widget و داشبوردهای اشتراکی معرفی کرد.

## نصب (Ubuntu 22.04)

\`\`\`bash
wget https://repo.zabbix.com/zabbix/7.0/ubuntu/pool/main/z/zabbix-release/zabbix-release_7.0-1+ubuntu22.04_all.deb
dpkg -i zabbix-release_7.0-1+ubuntu22.04_all.deb
apt update
apt install zabbix-server-mysql zabbix-frontend-php zabbix-agent2
\`\`\`

## ایجاد داشبورد شبکه

**ابزارک‌های ضروری برای پایش شبکه:**

۱. **ابزارک نمودار**: پهنای باند در هر رابط (۲۴ ساعت گذشته)
۲. **ابزارک Gauge**: درصد استفاده از CPU (آستانه‌های رنگی: سبز<۶۰، زرد<۸۰، قرمز>۸۰)
۳. **بهترین هاست‌ها**: هاست‌ها بر اساس ترافیک یا CPU
۴. **ابزارک نقشه**: توپولوژی شبکه با وضعیت زنده
۵. **ابزارک مشکل**: هشدارهای فعال بر اساس شدت

## یکپارچه‌سازی Grafana

\`\`\`bash
# نصب پلاگین Grafana Zabbix
grafana-cli plugins install alexanderzobnin-zabbix-app
\`\`\`

## تشدید هشدار

تشدید چند سطحی را پیکربندی کنید: ابتدا به نگهبان کشیک اطلاع دهید → ۱۵ دقیقه → به سرپرست تیم اطلاع دهید → ۳۰ دقیقه → به مدیر اطلاع دهید.`,
  },

  'grafana-network-monitoring': {
    contentEn: `## Network Monitoring Stack: Prometheus + Grafana

This guide deploys a complete observability stack for network infrastructure using Docker Compose.

## Docker Compose Stack

\`\`\`yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=90d'
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=SecurePass123
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"

  snmp-exporter:
    image: prom/snmp-exporter:latest
    volumes:
      - ./snmp.yml:/etc/snmp_exporter/snmp.yml
    ports:
      - "9116:9116"

volumes:
  prometheus-data:
  grafana-data:
\`\`\`

## Prometheus Configuration

\`\`\`yaml
# prometheus.yml
global:
  scrape_interval: 60s

scrape_configs:
  - job_name: 'mikrotik'
    static_configs:
      - targets:
          - 192.168.1.1  # router1
          - 192.168.1.2  # router2
    metrics_path: /snmp
    params:
      module: [mikrotik]
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - target_label: __address__
        replacement: snmp-exporter:9116

  - job_name: 'linux-servers'
    static_configs:
      - targets:
          - server1:9100
          - server2:9100
\`\`\`

## Key Grafana Dashboards

**Network Overview Dashboard panels:**
- Interface bandwidth (in/out) per device
- Packet error rate per interface
- BGP session states
- OSPF neighbor count
- CPU/RAM per network device

## Useful PromQL Queries

\`\`\`promql
# Bandwidth utilization %
rate(ifHCInOctets{ifAlias!=""}[5m]) * 8 / ifHighSpeed * 100

# Top 5 talkers
topk(5, rate(ifHCInOctets[5m]) * 8)

# Interface error rate
rate(ifInErrors[5m]) > 0
\`\`\`

## Alerting with Alertmanager

\`\`\`yaml
groups:
  - name: network
    rules:
      - alert: InterfaceDown
        expr: ifOperStatus == 2
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Interface {{ $labels.ifAlias }} is down"
\`\`\``,

    contentFa: `## استک پایش شبکه: Prometheus + Grafana

این راهنما یک استک مشاهده‌پذیری کامل برای زیرساخت شبکه با استفاده از Docker Compose استقرار می‌دهد.

## Docker Compose Stack

\`\`\`yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--storage.tsdb.retention.time=90d'
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=SecurePass123
    ports:
      - "3000:3000"

  snmp-exporter:
    image: prom/snmp-exporter:latest
    ports:
      - "9116:9116"
\`\`\`

## پرس‌وجوهای مفید PromQL

\`\`\`promql
# درصد استفاده از پهنای باند
rate(ifHCInOctets{ifAlias!=""}[5m]) * 8 / ifHighSpeed * 100

# ۵ بزرگترین مصرف‌کننده
topk(5, rate(ifHCInOctets[5m]) * 8)

# نرخ خطای رابط
rate(ifInErrors[5m]) > 0
\`\`\`

## هشداردهی با Alertmanager

\`\`\`yaml
groups:
  - name: network
    rules:
      - alert: InterfaceDown
        expr: ifOperStatus == 2
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "رابط {{ $labels.ifAlias }} خاموش است"
\`\`\``,
  },

  'snmp-monitoring-deep-dive': {
    contentEn: `## SNMP Deep Dive: From OID to Dashboard

SNMP (Simple Network Management Protocol) is the backbone of network monitoring. Understanding it deeply unlocks full visibility into any network device.

## SNMP Versions

| Version | Security | Use Case |
|---------|---------|---------|
| v1 | Cleartext | Legacy only |
| v2c | Cleartext community | Most monitoring |
| v3 | AuthPriv (AES+SHA) | Production |

## Walking the MIB Tree

\`\`\`bash
# Install tools
apt install snmp snmp-mibs-downloader

# Walk entire device MIB
snmpwalk -v2c -c public 192.168.1.1

# Get specific OID (CPU on MikroTik)
snmpget -v2c -c public 192.168.1.1 .1.3.6.1.4.1.14988.1.1.3.14.0

# Walk interface table
snmpwalk -v2c -c public 192.168.1.1 IF-MIB::ifTable
\`\`\`

## Important OIDs

\`\`\`
# Standard MIB-2
sysDescr:     .1.3.6.1.2.1.1.1.0
sysUpTime:    .1.3.6.1.2.1.1.3.0
ifInOctets:   .1.3.6.1.2.1.2.2.1.10.[ifIndex]
ifOutOctets:  .1.3.6.1.2.1.2.2.1.16.[ifIndex]
ifOperStatus: .1.3.6.1.2.1.2.2.1.8.[ifIndex]

# MikroTik private MIB
CPU load:     .1.3.6.1.4.1.14988.1.1.3.14.0
Free memory:  .1.3.6.1.4.1.14988.1.1.3.6.0
Voltage:      .1.3.6.1.4.1.14988.1.1.3.8.0
\`\`\`

## SNMP v3 Configuration (MikroTik)

\`\`\`bash
/snmp set enabled=yes
/snmp community add name=v3comm security=private authentication-protocol=SHA1 authentication-password=AuthPass123 encryption-protocol=AES encryption-password=EncPass123
\`\`\`

## Custom Zabbix SNMP Template

\`\`\`xml
<item>
    <name>CPU utilization</name>
    <type>SNMP_AGENT</type>
    <snmp_oid>.1.3.6.1.4.1.14988.1.1.3.14.0</snmp_oid>
    <key>mikrotik.cpu</key>
    <delay>60s</delay>
    <units>%</units>
    <triggers>
        <trigger>
            <expression>avg(/Template MikroTik/mikrotik.cpu,5m)>80</expression>
            <name>High CPU: {ITEM.VALUE}%</name>
            <priority>WARNING</priority>
        </trigger>
    </triggers>
</item>
\`\`\`

## Best Practices

- Always use SNMPv3 with AuthPriv in production
- Use read-only community strings — never write access
- Restrict SNMP access by source IP on the device
- Poll at 60s intervals minimum (don't over-poll)`,

    contentFa: `## آشنایی عمیق با SNMP: از OID تا داشبورد

SNMP (پروتکل ساده مدیریت شبکه) ستون فقرات پایش شبکه است. درک عمیق آن دید کامل به هر دستگاه شبکه را باز می‌کند.

## نسخه‌های SNMP

| نسخه | امنیت | کاربرد |
|---------|---------|---------|
| v1 | متن ساده | فقط legacy |
| v2c | Community متن ساده | اکثر پایش‌ها |
| v3 | AuthPriv (AES+SHA) | تولیدی |

## پیمایش درخت MIB

\`\`\`bash
# نصب ابزارها
apt install snmp snmp-mibs-downloader

# پیمایش کل MIB دستگاه
snmpwalk -v2c -c public 192.168.1.1

# دریافت OID خاص (CPU روی MikroTik)
snmpget -v2c -c public 192.168.1.1 .1.3.6.1.4.1.14988.1.1.3.14.0
\`\`\`

## OID‌های مهم

\`\`\`
# MIB-2 استاندارد
sysDescr:     .1.3.6.1.2.1.1.1.0
ifInOctets:   .1.3.6.1.2.1.2.2.1.10.[ifIndex]
ifOperStatus: .1.3.6.1.2.1.2.2.1.8.[ifIndex]

# MIB خصوصی MikroTik
بار CPU:      .1.3.6.1.4.1.14988.1.1.3.14.0
حافظه آزاد:  .1.3.6.1.4.1.14988.1.1.3.6.0
\`\`\`

## پیکربندی SNMP v3 (MikroTik)

\`\`\`bash
/snmp set enabled=yes
/snmp community add name=v3comm security=private authentication-protocol=SHA1 authentication-password=AuthPass123 encryption-protocol=AES encryption-password=EncPass123
\`\`\`

## بهترین شیوه‌ها

- همیشه در تولید از SNMPv3 با AuthPriv استفاده کنید
- از رشته‌های Community فقط‌خواندنی استفاده کنید — هرگز دسترسی نوشتن
- دسترسی SNMP را با IP منبع روی دستگاه محدود کنید
- حداقل با فاصله ۶۰ ثانیه Poll کنید`,
  },

  'ansible-network-automation': {
    contentEn: `## Ansible for Network Automation

Ansible connects to network devices over SSH (or API) and applies configuration idempotently — the same playbook run twice produces the same result.

## Installation

\`\`\`bash
pip install ansible ansible-pylibssh
ansible-galaxy collection install community.routeros cisco.ios
\`\`\`

## Inventory File

\`\`\`ini
# inventory/hosts.yml
all:
  children:
    mikrotik:
      hosts:
        router1:
          ansible_host: 192.168.1.1
          ansible_user: admin
          ansible_connection: ansible.netcommon.network_cli
          ansible_network_os: community.routeros.routeros
    cisco:
      hosts:
        sw1:
          ansible_host: 192.168.1.10
          ansible_user: cisco
          ansible_connection: ansible.netcommon.network_cli
          ansible_network_os: cisco.ios.ios
\`\`\`

## MikroTik Playbook: Backup Configs

\`\`\`yaml
# backup-configs.yml
- name: Backup MikroTik Configurations
  hosts: mikrotik
  gather_facts: false
  tasks:
    - name: Export configuration
      community.routeros.command:
        commands:
          - /export file=backup-{{ inventory_hostname }}
      register: result

    - name: Download backup file
      community.routeros.fetch:
        src: "/backup-{{ inventory_hostname }}.rsc"
        dest: "./backups/{{ inventory_hostname }}-{{ ansible_date_time.date }}.rsc"
\`\`\`

## Cisco IOS Playbook: VLAN Provisioning

\`\`\`yaml
- name: Provision VLANs on Cisco switches
  hosts: cisco
  gather_facts: false
  vars:
    vlans:
      - id: 10
        name: CORP
      - id: 20
        name: GUEST
      - id: 30
        name: SERVERS
  tasks:
    - name: Create VLANs
      cisco.ios.ios_vlans:
        config:
          - vlan_id: "{{ item.id }}"
            name: "{{ item.name }}"
            state: active
        state: merged
      loop: "{{ vlans }}"

    - name: Save running config
      cisco.ios.ios_command:
        commands: write memory
\`\`\`

## Bulk Interface Description Update

\`\`\`yaml
- name: Update interface descriptions
  hosts: mikrotik
  gather_facts: false
  tasks:
    - name: Set interface comments
      community.routeros.command:
        commands:
          - /interface set [find name=ether1] comment="Uplink-ISP1"
          - /interface set [find name=ether2] comment="Core-Switch-Trunk"
\`\`\`

## Scheduling with Cron

\`\`\`bash
# Run backup every night at 2am
0 2 * * * ansible-playbook -i inventory/hosts.yml backup-configs.yml >> /var/log/ansible-backup.log 2>&1
\`\`\``,

    contentFa: `## Ansible برای خودکارسازی شبکه

Ansible از طریق SSH (یا API) به تجهیزات شبکه متصل می‌شود و پیکربندی را به‌صورت Idempotent اعمال می‌کند.

## نصب

\`\`\`bash
pip install ansible ansible-pylibssh
ansible-galaxy collection install community.routeros cisco.ios
\`\`\`

## فایل Inventory

\`\`\`ini
all:
  children:
    mikrotik:
      hosts:
        router1:
          ansible_host: 192.168.1.1
          ansible_user: admin
          ansible_network_os: community.routeros.routeros
    cisco:
      hosts:
        sw1:
          ansible_host: 192.168.1.10
          ansible_network_os: cisco.ios.ios
\`\`\`

## Playbook MikroTik: پشتیبان‌گیری از پیکربندی‌ها

\`\`\`yaml
- name: پشتیبان‌گیری از پیکربندی‌های MikroTik
  hosts: mikrotik
  gather_facts: false
  tasks:
    - name: Export پیکربندی
      community.routeros.command:
        commands:
          - /export file=backup-{{ inventory_hostname }}
\`\`\`

## Playbook Cisco IOS: فراهم‌سازی VLAN

\`\`\`yaml
- name: فراهم‌سازی VLAN‌ها روی سوئیچ‌های Cisco
  hosts: cisco
  gather_facts: false
  tasks:
    - name: ایجاد VLAN‌ها
      cisco.ios.ios_vlans:
        config:
          - vlan_id: 10
            name: CORP
          - vlan_id: 20
            name: GUEST
        state: merged

    - name: ذخیره پیکربندی
      cisco.ios.ios_command:
        commands: write memory
\`\`\`

## زمان‌بندی با Cron

\`\`\`bash
# اجرای پشتیبان‌گیری هر شب ساعت ۲ بامداد
0 2 * * * ansible-playbook -i inventory/hosts.yml backup-configs.yml
\`\`\``,
  },

  'python-network-automation': {
    contentEn: `## Python Network Automation with Netmiko and NAPALM

Python gives you full programmatic control over network devices. Netmiko handles SSH connections; NAPALM provides a vendor-neutral API.

## Installation

\`\`\`bash
pip install netmiko napalm
\`\`\`

## Netmiko: Basic Connection

\`\`\`python
from netmiko import ConnectHandler

device = {
    'device_type': 'mikrotik_routeros',
    'host': '192.168.1.1',
    'username': 'admin',
    'password': 'password',
}

with ConnectHandler(**device) as conn:
    output = conn.send_command('/ip address print')
    print(output)
\`\`\`

## Bulk Configuration Backup

\`\`\`python
import json
from datetime import date
from netmiko import ConnectHandler
from pathlib import Path

devices = json.load(open('devices.json'))
backup_dir = Path(f"backups/{date.today()}")
backup_dir.mkdir(parents=True, exist_ok=True)

for device in devices:
    try:
        with ConnectHandler(**device) as conn:
            if device['device_type'] == 'mikrotik_routeros':
                config = conn.send_command('/export')
            elif device['device_type'] == 'cisco_ios':
                config = conn.send_command('show running-config')
            
            filename = backup_dir / f"{device['host']}.txt"
            filename.write_text(config)
            print(f"✓ {device['host']} backed up")
    except Exception as e:
        print(f"✗ {device['host']}: {e}")
\`\`\`

## NAPALM: Vendor-Neutral API

\`\`\`python
from napalm import get_network_driver

driver = get_network_driver('ios')
device = driver(
    hostname='192.168.1.10',
    username='cisco',
    password='password'
)

device.open()

# Get structured data
facts = device.get_facts()
print(f"Hostname: {facts['hostname']}")
print(f"Uptime: {facts['uptime']} seconds")

interfaces = device.get_interfaces()
for iface, data in interfaces.items():
    status = "UP" if data['is_up'] else "DOWN"
    print(f"  {iface}: {status} — {data['description']}")

# Config diff before applying
device.load_merge_candidate(filename='changes.txt')
print(device.compare_config())

device.commit_config()  # or device.discard_config()
device.close()
\`\`\`

## Network Audit Script

\`\`\`python
def audit_snmp(devices):
    """Check SNMP is configured on all devices"""
    issues = []
    for device in devices:
        with ConnectHandler(**device) as conn:
            output = conn.send_command('/snmp print')
            if 'enabled: no' in output:
                issues.append(f"{device['host']}: SNMP disabled")
    return issues
\`\`\`

## Scheduling and Reporting

Use APScheduler for periodic tasks and send results via email or Slack webhook.`,

    contentFa: `## خودکارسازی شبکه Python با Netmiko و NAPALM

Python کنترل برنامه‌نویسی کامل بر روی تجهیزات شبکه می‌دهد. Netmiko اتصالات SSH را مدیریت می‌کند؛ NAPALM یک API فروشنده-خنثی فراهم می‌کند.

## نصب

\`\`\`bash
pip install netmiko napalm
\`\`\`

## Netmiko: اتصال پایه

\`\`\`python
from netmiko import ConnectHandler

device = {
    'device_type': 'mikrotik_routeros',
    'host': '192.168.1.1',
    'username': 'admin',
    'password': 'password',
}

with ConnectHandler(**device) as conn:
    output = conn.send_command('/ip address print')
    print(output)
\`\`\`

## پشتیبان‌گیری انبوه از پیکربندی

\`\`\`python
import json
from datetime import date
from netmiko import ConnectHandler
from pathlib import Path

devices = json.load(open('devices.json'))
backup_dir = Path(f"backups/{date.today()}")
backup_dir.mkdir(parents=True, exist_ok=True)

for device in devices:
    try:
        with ConnectHandler(**device) as conn:
            config = conn.send_command('/export')
            Path(backup_dir / f"{device['host']}.txt").write_text(config)
            print(f"✓ {device['host']} پشتیبان‌گیری شد")
    except Exception as e:
        print(f"✗ {device['host']}: {e}")
\`\`\`

## NAPALM: API فروشنده-خنثی

\`\`\`python
from napalm import get_network_driver

driver = get_network_driver('ios')
device = driver(hostname='192.168.1.10', username='cisco', password='password')
device.open()

facts = device.get_facts()
print(f"Hostname: {facts['hostname']}")

device.load_merge_candidate(filename='changes.txt')
print(device.compare_config())
device.commit_config()
device.close()
\`\`\``,
  },

  'linux-server-hardening': {
    contentEn: `## Linux Server Hardening: Production Checklist

A hardened Linux server significantly reduces attack surface. This is the checklist I apply to every production server.

## 1. SSH Hardening

\`\`\`bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deployuser adminuser
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
Protocol 2
\`\`\`

\`\`\`bash
systemctl restart sshd
\`\`\`

## 2. Firewall with UFW

\`\`\`bash
ufw default deny incoming
ufw default allow outgoing
ufw allow from 10.0.0.0/8 to any port 22  # SSH from internal only
ufw allow 443/tcp
ufw allow 80/tcp
ufw enable
\`\`\`

## 3. Fail2Ban

\`\`\`bash
apt install fail2ban

# /etc/fail2ban/jail.local
[sshd]
enabled = true
maxretry = 3
bantime = 3600
findtime = 600
\`\`\`

## 4. Automatic Security Updates

\`\`\`bash
apt install unattended-upgrades
dpkg-reconfigure unattended-upgrades
\`\`\`

## 5. Kernel Hardening (sysctl)

\`\`\`bash
# /etc/sysctl.d/99-hardening.conf
net.ipv4.ip_forward = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
kernel.randomize_va_space = 2
kernel.dmesg_restrict = 1
fs.suid_dumpable = 0

sysctl -p /etc/sysctl.d/99-hardening.conf
\`\`\`

## 6. Audit Logging

\`\`\`bash
apt install auditd audispd-plugins

# /etc/audit/rules.d/hardening.rules
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k sudo
-a always,exit -F arch=b64 -S execve -k exec
\`\`\`

## 7. Remove Unnecessary Services

\`\`\`bash
systemctl disable --now avahi-daemon cups bluetooth rpcbind
apt remove telnetd ftp rsh-server
\`\`\`

## 8. CIS Benchmark Compliance

Use \`lynis\` to score your hardening:

\`\`\`bash
apt install lynis
lynis audit system
\`\`\`

Target score: 70+ (production servers should reach 80+).`,

    contentFa: `## سخت‌سازی سرور لینوکس: چک‌لیست تولیدی

یک سرور لینوکس سخت‌شده سطح حمله را به‌طور قابل توجهی کاهش می‌دهد. این چک‌لیستی است که روی هر سرور تولیدی اعمال می‌کنم.

## ۱. سخت‌سازی SSH

\`\`\`bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deployuser adminuser
MaxAuthTries 3
\`\`\`

## ۲. فایروال با UFW

\`\`\`bash
ufw default deny incoming
ufw default allow outgoing
ufw allow from 10.0.0.0/8 to any port 22
ufw allow 443/tcp
ufw enable
\`\`\`

## ۳. Fail2Ban

\`\`\`bash
apt install fail2ban

# /etc/fail2ban/jail.local
[sshd]
enabled = true
maxretry = 3
bantime = 3600
\`\`\`

## ۴. به‌روزرسانی‌های امنیتی خودکار

\`\`\`bash
apt install unattended-upgrades
dpkg-reconfigure unattended-upgrades
\`\`\`

## ۵. سخت‌سازی هسته (sysctl)

\`\`\`bash
# /etc/sysctl.d/99-hardening.conf
net.ipv4.ip_forward = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.log_martians = 1
kernel.randomize_va_space = 2
kernel.dmesg_restrict = 1
\`\`\`

## ۶. لاگ‌گیری Audit

\`\`\`bash
apt install auditd

# /etc/audit/rules.d/hardening.rules
-w /etc/passwd -p wa -k identity
-w /etc/sudoers -p wa -k sudo
-a always,exit -F arch=b64 -S execve -k exec
\`\`\`

## ۷. بررسی انطباق CIS

\`\`\`bash
apt install lynis
lynis audit system
\`\`\`

هدف: امتیاز ۷۰+ (سرورهای تولیدی باید به ۸۰+ برسند).`,
  },

  'nginx-reverse-proxy-setup': {
    contentEn: `## Nginx Reverse Proxy with SSL and Load Balancing

Nginx is the most deployed reverse proxy/load balancer. This covers a production-ready setup with Let's Encrypt SSL.

## Installation

\`\`\`bash
apt install nginx certbot python3-certbot-nginx
\`\`\`

## Basic Reverse Proxy

\`\`\`nginx
# /etc/nginx/sites-available/app.conf
server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

## Load Balancing Multiple Backends

\`\`\`nginx
upstream backend {
    least_conn;
    server 10.0.0.10:3000 weight=3;
    server 10.0.0.11:3000 weight=2;
    server 10.0.0.12:3000 weight=1 backup;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://backend;
        proxy_next_upstream error timeout;
        health_check interval=10 fails=3 passes=2;
    }
}
\`\`\`

## Rate Limiting

\`\`\`nginx
# /etc/nginx/nginx.conf
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=conn:10m;

    server {
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            limit_conn conn 10;
        }
    }
}
\`\`\`

## Let's Encrypt Certificate

\`\`\`bash
certbot --nginx -d app.example.com -d www.app.example.com
# Auto-renewal via systemd timer (enabled by default)
certbot renew --dry-run
\`\`\`

## Security Headers

\`\`\`nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options SAMEORIGIN;
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
\`\`\``,

    contentFa: `## Nginx Reverse Proxy با SSL و Load Balancing

Nginx پرکاربردترین Reverse Proxy/Load Balancer است. این یک راه‌اندازی آماده برای تولید با SSL از Let's Encrypt را پوشش می‌دهد.

## نصب

\`\`\`bash
apt install nginx certbot python3-certbot-nginx
\`\`\`

## Reverse Proxy پایه

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
\`\`\`

## Load Balancing بین چند Backend

\`\`\`nginx
upstream backend {
    least_conn;
    server 10.0.0.10:3000 weight=3;
    server 10.0.0.11:3000 weight=2;
    server 10.0.0.12:3000 weight=1 backup;
}
\`\`\`

## محدودیت نرخ

\`\`\`nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
}
\`\`\`

## گواهی Let's Encrypt

\`\`\`bash
certbot --nginx -d app.example.com
certbot renew --dry-run
\`\`\`

## هدرهای امنیتی

\`\`\`nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options SAMEORIGIN;
\`\`\``,
  },

  'linux-performance-tuning': {
    contentEn: `## Linux Kernel Performance Tuning for Network Servers

High-throughput network servers require kernel-level tuning beyond defaults. Here are the key parameters.

## TCP Buffer Sizes

\`\`\`bash
# /etc/sysctl.d/99-network-performance.conf

# Increase TCP buffer sizes (for 10GbE)
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# Increase backlog queue
net.core.netdev_max_backlog = 300000
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 30000

# TCP keepalive
net.ipv4.tcp_keepalive_time = 60
net.ipv4.tcp_keepalive_intvl = 10
net.ipv4.tcp_keepalive_probes = 6

# Faster TIME_WAIT recycling
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
\`\`\`

\`\`\`bash
sysctl -p /etc/sysctl.d/99-network-performance.conf
\`\`\`

## IRQ Affinity

Pin network card interrupts to specific CPU cores to reduce cache misses:

\`\`\`bash
# List IRQs for your NIC
cat /proc/interrupts | grep eth0

# Set affinity (pin IRQ 45 to CPU 2)
echo 4 > /proc/irq/45/smp_affinity  # bitmask: CPU 2 = bit 2 = 0x4

# Or use irqbalance for automatic distribution
apt install irqbalance
systemctl enable --now irqbalance
\`\`\`

## CPU Governor

\`\`\`bash
# Set performance governor
apt install cpufrequtils
cpufreq-set -g performance

# Or persist via systemd
cat > /etc/systemd/system/cpufreq.service << EOF
[Unit]
Description=Set CPU performance governor
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo performance > $cpu; done'
[Install]
WantedBy=multi-user.target
EOF
\`\`\`

## I/O Scheduler

For NVMe drives, use \`none\`; for SSDs, use \`mq-deadline\`:

\`\`\`bash
echo none > /sys/block/nvme0n1/queue/scheduler
echo mq-deadline > /sys/block/sda/queue/scheduler
\`\`\`

## NUMA Awareness

For multi-socket servers, run network applications on the same NUMA node as the NIC:

\`\`\`bash
numactl --cpunodebind=0 --membind=0 nginx -g 'daemon off;'
\`\`\`

## Benchmarking

\`\`\`bash
# Network throughput
iperf3 -s  # on server
iperf3 -c server_ip -P 8 -t 30  # on client

# Disk IOPS
fio --name=randread --ioengine=libaio --iodepth=32 --rw=randread --bs=4k --numjobs=4 --size=1G --runtime=60 --group_reporting
\`\`\``,

    contentFa: `## تنظیم عملکرد هسته لینوکس برای سرورهای شبکه

سرورهای شبکه پرترافیک نیاز به تنظیم در سطح هسته فراتر از مقادیر پیش‌فرض دارند.

## اندازه‌های بافر TCP

\`\`\`bash
# /etc/sysctl.d/99-network-performance.conf
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.netdev_max_backlog = 300000
net.core.somaxconn = 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
\`\`\`

## IRQ Affinity

وقفه‌های کارت شبکه را به هسته‌های CPU خاص اختصاص دهید تا کش miss‌ها کاهش یابد:

\`\`\`bash
# لیست IRQ‌ها برای NIC شما
cat /proc/interrupts | grep eth0

# تنظیم Affinity
echo 4 > /proc/irq/45/smp_affinity
\`\`\`

## تنظیم CPU Governor

\`\`\`bash
apt install cpufrequtils
cpufreq-set -g performance
\`\`\`

## I/O Scheduler

برای درایوهای NVMe از \`none\` استفاده کنید؛ برای SSD از \`mq-deadline\`:

\`\`\`bash
echo none > /sys/block/nvme0n1/queue/scheduler
\`\`\`

## بنچمارک

\`\`\`bash
# توان عملیاتی شبکه
iperf3 -s  # روی سرور
iperf3 -c server_ip -P 8 -t 30  # روی کلاینت

# IOPS دیسک
fio --name=randread --ioengine=libaio --iodepth=32 --rw=randread --bs=4k --numjobs=4 --size=1G --runtime=60
\`\`\``,
  },

  'vmware-vsphere-ha-configuration': {
    contentEn: `## VMware vSphere HA: Configuration and Best Practices

vSphere HA monitors VMs and restarts them on another host if a failure occurs. Proper configuration is essential.

## HA Admission Control

Admission control ensures the cluster has enough resources to restart VMs after a host failure.

\`\`\`
vSphere Client: Cluster → Configure → vSphere Availability

Settings:
- Failures and responses: 1 host failure (default)
- Admission control: Reserve 25% CPU and Memory
  OR: Define failover hosts
- VM restart priority: High for critical VMs
- Response for Host Isolation: Power off and restart VMs
\`\`\`

## VM Restart Priorities

Assign priorities to control restart order:

| Priority | VM Type |
|----------|---------|
| Highest | Domain Controllers, Core Infrastructure |
| High | Database servers, Key applications |
| Medium | App servers |
| Low | Dev/test VMs |

## Datastore Heartbeating

Configure 2+ heartbeat datastores (different arrays if possible):

\`\`\`
Cluster → Configure → vSphere Availability → Datastore Heartbeating
→ Select datastores to use for heartbeating: [DS1] [DS2]
\`\`\`

## Host Isolation Response

\`\`\`
Isolation address: 10.0.0.1 (your gateway — not another ESXi host!)
Response: Power off and restart VMs
\`\`\`

## Proactive HA

Proactive HA works with hardware vendor plugins to detect degraded hardware before failure:

\`\`\`
Cluster → Configure → Proactive HA
→ Enable
→ Remediation: Automated (for production)
\`\`\`

## Monitoring HA Events

\`\`\`powershell
# PowerCLI - Check recent HA events
Get-VIEvent -MaxSamples 100 -Type Warning,Error | 
  Where-Object {$_.FullFormattedMessage -like "*HA*"} |
  Select-Object CreatedTime, FullFormattedMessage
\`\`\`

## Common HA Issues

- **HA agent unreachable**: Check management network isolation
- **Insufficient failover capacity**: Too many VMs for 1-host failure capacity
- **VM not restarting**: Check datastore accessibility on all hosts
- **Split-brain**: Always use isolation address on a gateway, not another host`,

    contentFa: `## VMware vSphere HA: پیکربندی و بهترین شیوه‌ها

vSphere HA VM‌ها را پایش می‌کند و در صورت خرابی آن‌ها را روی هاست دیگری راه‌اندازی مجدد می‌کند.

## کنترل پذیرش HA

کنترل پذیرش اطمینان می‌دهد که کلاستر منابع کافی برای راه‌اندازی مجدد VM‌ها پس از خرابی هاست دارد.

\`\`\`
تنظیمات:
- خرابی و پاسخ‌ها: ۱ خرابی هاست (پیش‌فرض)
- کنترل پذیرش: ذخیره ۲۵٪ CPU و حافظه
- اولویت راه‌اندازی مجدد VM: بالا برای VM‌های حیاتی
\`\`\`

## اولویت‌های راه‌اندازی مجدد VM

| اولویت | نوع VM |
|----------|---------|
| بالاترین | Domain Controller‌ها، زیرساخت هسته |
| بالا | سرورهای پایگاه‌داده |
| متوسط | سرورهای برنامه |
| پایین | VM‌های توسعه/آزمایش |

## Heartbeating Datastore

۲ یا بیشتر datastore heartbeat پیکربندی کنید:

\`\`\`
Cluster → Configure → vSphere Availability → Datastore Heartbeating
→ انتخاب datastoreها برای heartbeating: [DS1] [DS2]
\`\`\`

## Proactive HA

Proactive HA با پلاگین‌های فروشنده سخت‌افزار کار می‌کند تا سخت‌افزار تخریب‌شده را قبل از خرابی تشخیص دهد.

## مشکلات رایج HA

- **عامل HA غیرقابل دسترس**: بررسی ایزولاسیون شبکه مدیریتی
- **ظرفیت Failover ناکافی**: VM‌های زیادی برای ظرفیت خرابی ۱ هاست
- **Split-brain**: همیشه از آدرس ایزولاسیون روی Gateway استفاده کنید، نه هاست دیگر`,
  },

  'vmware-network-design': {
    contentEn: `## VMware Distributed Switch Design

vSphere Distributed Switch (VDS) centralizes network management across the entire cluster. This guide covers production design patterns.

## VDS vs Standard Switch

| Feature | Standard vSwitch | Distributed vSwitch |
|---------|---------|---------|
| Management | Per-host | Centralized |
| Port groups | Per-host | Cluster-wide |
| LACP | No | Yes |
| NetFlow | No | Yes |
| LLDP | No | Yes |
| Traffic shaping | Ingress | Ingress + Egress |

## VDS Design for Enterprise

\`\`\`
VDS-Production
├── dvPortGroup-Management     (VLAN 99, teaming: active-standby)
├── dvPortGroup-vMotion        (VLAN 100, jumbo frames MTU 9000)
├── dvPortGroup-vSAN           (VLAN 101, jumbo frames MTU 9000)
├── dvPortGroup-VM-Corporate   (VLAN 10, load balance: route by port ID)
├── dvPortGroup-VM-DMZ         (VLAN 20, promiscuous mode off)
└── dvPortGroup-iSCSI          (VLAN 102, dedicated VMNIC)
\`\`\`

## LACP Configuration

\`\`\`powershell
# PowerCLI - Create LACP LAG
$vds = Get-VDSwitch "VDS-Production"
New-VDLacpGroup -VDSwitch $vds -Name "LAG1" -Mode Active -LoadBalancingMode LoadBalanceSrcDestIpTcpUdpPortVlan
\`\`\`

## Traffic Shaping for VM Networks

\`\`\`
dvPortGroup Properties → Traffic Shaping:
- Ingress: Average 1000 Mbit/s, Peak 2000 Mbit/s, Burst 512 MB
- Egress: Average 500 Mbit/s, Peak 1000 Mbit/s
\`\`\`

## NIC Teaming Policy

Different policies for different traffic types:

- **Management**: Active/Standby (predictable, one active NIC)
- **vMotion**: Load balance by IP hash (needs LACP on switch)
- **VM traffic**: Route based on originating virtual port (no LACP needed)
- **iSCSI**: Multi-pathing with one VMkernel per NIC

## MTU for vMotion and vSAN

Always enable jumbo frames (MTU 9000) for vMotion and vSAN traffic. Requires physical switch ports also configured for MTU 9000.

\`\`\`powershell
# Verify VMkernel MTU
Get-VMHostNetworkAdapter -VMKernel | Select-Object Name, Mtu, VMotionEnabled, VsanEnabled
\`\`\``,

    contentFa: `## طراحی VMware Distributed Switch

vSphere Distributed Switch (VDS) مدیریت شبکه را در سراسر کلاستر متمرکز می‌کند.

## VDS در مقابل Standard Switch

| ویژگی | Standard vSwitch | Distributed vSwitch |
|---------|---------|---------|
| مدیریت | هر هاست | متمرکز |
| Port group‌ها | هر هاست | سراسر کلاستر |
| LACP | خیر | بله |
| NetFlow | خیر | بله |

## طراحی VDS برای سازمان

\`\`\`
VDS-Production
├── dvPortGroup-Management     (VLAN 99)
├── dvPortGroup-vMotion        (VLAN 100، MTU 9000)
├── dvPortGroup-vSAN           (VLAN 101، MTU 9000)
├── dvPortGroup-VM-Corporate   (VLAN 10)
└── dvPortGroup-iSCSI          (VLAN 102)
\`\`\`

## پالیسی Teaming NIC

سیاست‌های مختلف برای انواع مختلف ترافیک:

- **مدیریت**: Active/Standby (یک NIC فعال)
- **vMotion**: توازن بار بر اساس IP hash (نیاز به LACP روی سوئیچ)
- **ترافیک VM**: مسیریابی بر اساس پورت مجازی مبدأ
- **iSCSI**: Multi-pathing با یک VMkernel برای هر NIC

## MTU برای vMotion و vSAN

همیشه Jumbo Frame (MTU 9000) را برای ترافیک vMotion و vSAN فعال کنید. نیاز به پیکربندی پورت‌های سوئیچ فیزیکی با MTU 9000 نیز دارد.`,
  },

  'active-directory-design-enterprise': {
    contentEn: `## Active Directory Design for Multi-Site Enterprises

AD design decisions made early have long-lasting consequences. This guide covers forest, domain, site, and replication topology design.

## Single Forest vs Multiple Forests

**Single forest (recommended for most):**
- Centralized administration
- Seamless SSO across all domains
- Lower operational overhead

**Multiple forests when needed:**
- Acquisitions with incompatible schemas
- Legal/regulatory separation requirements
- Security isolation requirements

## Domain Design

For a holding company with subsidiaries:

\`\`\`
Forest root: corp.local (resource minimal — no user accounts)
├── Child: hq.corp.local      (HQ users, servers)
├── Child: subsidiary1.corp.local
└── Child: subsidiary2.corp.local
\`\`\`

Or simpler with OUs:

\`\`\`
Single domain: corp.local
├── OU=HQ
│   ├── OU=Users
│   ├── OU=Computers
│   └── OU=Servers
├── OU=Branch1
│   ├── OU=Users
│   └── OU=Computers
└── OU=Subsidiary1
\`\`\`

## Sites and Subnets

Define one AD site per physical location:

\`\`\`powershell
# Create sites
New-ADReplicationSite "HQ-Tehran"
New-ADReplicationSite "Branch-Mashhad"

# Create subnets
New-ADReplicationSubnet -Name "10.1.0.0/16" -Site "HQ-Tehran"
New-ADReplicationSubnet -Name "10.2.0.0/16" -Site "Branch-Mashhad"

# Create site link
New-ADReplicationSiteLink -Name "HQ-to-Mashhad" -SitesIncluded HQ-Tehran,Branch-Mashhad -Cost 100 -ReplicationFrequencyInMinutes 15
\`\`\`

## DC Placement

- **HQ**: 2 DCs minimum (one as PDC Emulator/RID/Infrastructure master)
- **Branch with 50+ users**: 1 local DC (RODC preferred if untrusted site)
- **Small branches (<50 users)**: No local DC, rely on WAN

## RODC for Remote Sites

Read-Only Domain Controllers for sites with poor physical security:

\`\`\`powershell
Install-ADDSDomainController -DomainName corp.local -ReadOnlyReplica -SiteName Branch-Mashhad -Credential (Get-Credential)
\`\`\`

RODC caches passwords only for approved accounts — if stolen, blast radius is limited.

## GPO Design

\`\`\`
Default Domain Policy: Password/lockout policy only
├── GPO-Baseline-Workstations: CIS benchmark settings
├── GPO-Baseline-Servers: Stricter security
├── GPO-Software-Corp: Core software deployment
└── GPO-Proxy-Settings: PAC file URL
\`\`\``,

    contentFa: `## طراحی Active Directory برای سازمان‌های چند سایته

تصمیمات طراحی AD که زود گرفته می‌شوند پیامدهای طولانی‌مدت دارند.

## یک Forest در مقابل چند Forest

**یک Forest (توصیه‌شده برای اکثر موارد):**
- مدیریت متمرکز
- SSO یکپارچه در تمام دامنه‌ها
- سربار عملیاتی کمتر

## طراحی دامنه

برای یک هلدینگ با زیرمجموعه‌ها:

\`\`\`
Forest root: corp.local
├── فرزند: hq.corp.local
├── فرزند: subsidiary1.corp.local
└── فرزند: subsidiary2.corp.local
\`\`\`

## سایت‌ها و زیرشبکه‌ها

\`\`\`powershell
New-ADReplicationSite "HQ-Tehran"
New-ADReplicationSite "Branch-Mashhad"
New-ADReplicationSubnet -Name "10.1.0.0/16" -Site "HQ-Tehran"
New-ADReplicationSiteLink -Name "HQ-to-Mashhad" -SitesIncluded HQ-Tehran,Branch-Mashhad -Cost 100 -ReplicationFrequencyInMinutes 15
\`\`\`

## قرارگیری DC

- **HQ**: حداقل ۲ DC
- **شعبه با ۵۰+ کاربر**: ۱ DC محلی (ترجیحاً RODC برای سایت غیرقابل اعتماد)
- **شعب کوچک (کمتر از ۵۰ کاربر)**: بدون DC محلی

## RODC برای سایت‌های راه دور

\`\`\`powershell
Install-ADDSDomainController -DomainName corp.local -ReadOnlyReplica -SiteName Branch-Mashhad -Credential (Get-Credential)
\`\`\`

RODC رمزعبورها را فقط برای حساب‌های تأییدشده Cache می‌کند — اگر دزدیده شود، شعاع انفجار محدود است.`,
  },

  'windows-server-core-hardening': {
    contentEn: `## Windows Server Core Hardening with CIS Benchmarks

CIS Benchmarks provide scored recommendations for Windows Server hardening. This guide applies Level 1 and Level 2 controls.

## Account Policies via Group Policy

\`\`\`powershell
# Minimum password length: 14
Set-ADDefaultDomainPasswordPolicy -MinPasswordLength 14 -MaxPasswordAge (New-TimeSpan -Days 90) -LockoutThreshold 5 -LockoutDuration (New-TimeSpan -Minutes 30)
\`\`\`

## Audit Policy

\`\`\`powershell
# Enable advanced audit
auditpol /set /subcategory:"Logon" /success:enable /failure:enable
auditpol /set /subcategory:"Account Logon" /success:enable /failure:enable
auditpol /set /subcategory:"Privilege Use" /success:enable /failure:enable
auditpol /set /subcategory:"Process Creation" /success:enable
auditpol /set /subcategory:"Object Access" /failure:enable
\`\`\`

## Registry Hardening

\`\`\`powershell
# Disable SMBv1
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force

# Disable LLMNR
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name EnableMulticast -Value 0

# Disable NetBIOS
$nics = Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object {$_.IPEnabled}
$nics | ForEach-Object { $_.SetTcpipNetbios(2) }

# Disable WPAD
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings\Wpad" -Name WpadOverride -Value 1
\`\`\`

## Windows Firewall Baseline

\`\`\`powershell
# Enable all firewall profiles
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True -DefaultInboundAction Block -DefaultOutboundAction Allow

# Allow management
New-NetFirewallRule -DisplayName "Allow RDP from Management" -Direction Inbound -Protocol TCP -LocalPort 3389 -RemoteAddress 10.0.0.0/8 -Action Allow
\`\`\`

## Disable Unnecessary Services

\`\`\`powershell
$services = @(
    'XblAuthManager', 'XblGameSave', 'XboxNetApiSvc',
    'Fax', 'TabletInputService', 'WMPNetworkSvc',
    'lfsvc', 'MapsBroker', 'SharedAccess'
)
$services | ForEach-Object {
    Stop-Service $_ -ErrorAction SilentlyContinue
    Set-Service $_ -StartupType Disabled -ErrorAction SilentlyContinue
}
\`\`\`

## Microsoft Security Compliance Toolkit

Use SCT to apply and report on CIS/MSFT baselines:

\`\`\`powershell
# Apply security baseline
.\Baseline-LocalInstall.ps1 -Win2022NonDomainJoined

# Check compliance
.\Compare-GPOtoBaseline.ps1 -BaselineName "Windows Server 2022"
\`\`\``,

    contentFa: `## سخت‌سازی Windows Server Core با معیارهای CIS

CIS Benchmark توصیه‌های امتیازدهی‌شده برای سخت‌سازی Windows Server ارائه می‌دهد.

## پالیسی حساب از طریق Group Policy

\`\`\`powershell
Set-ADDefaultDomainPasswordPolicy -MinPasswordLength 14 -MaxPasswordAge (New-TimeSpan -Days 90) -LockoutThreshold 5 -LockoutDuration (New-TimeSpan -Minutes 30)
\`\`\`

## پالیسی Audit

\`\`\`powershell
auditpol /set /subcategory:"Logon" /success:enable /failure:enable
auditpol /set /subcategory:"Account Logon" /success:enable /failure:enable
auditpol /set /subcategory:"Privilege Use" /success:enable /failure:enable
auditpol /set /subcategory:"Process Creation" /success:enable
\`\`\`

## سخت‌سازی Registry

\`\`\`powershell
# غیرفعال کردن SMBv1
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force

# غیرفعال کردن LLMNR
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name EnableMulticast -Value 0

# غیرفعال کردن NetBIOS
$nics = Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object {$_.IPEnabled}
$nics | ForEach-Object { $_.SetTcpipNetbios(2) }
\`\`\`

## فایروال Windows

\`\`\`powershell
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True -DefaultInboundAction Block
New-NetFirewallRule -DisplayName "Allow RDP from Management" -Direction Inbound -Protocol TCP -LocalPort 3389 -RemoteAddress 10.0.0.0/8 -Action Allow
\`\`\`

## غیرفعال کردن سرویس‌های غیرضروری

\`\`\`powershell
$services = @('Fax', 'TabletInputService', 'WMPNetworkSvc', 'lfsvc', 'MapsBroker')
$services | ForEach-Object {
    Stop-Service $_ -ErrorAction SilentlyContinue
    Set-Service $_ -StartupType Disabled -ErrorAction SilentlyContinue
}
\`\`\``,
  },

  'cisco-bgp-enterprise-isp': {
    contentEn: `## BGP Configuration for Enterprise Internet Redundancy

Dual-homed BGP gives an enterprise two independent internet paths with automatic failover and optional load balancing.

## Lab Topology

\`\`\`
ISP1 (AS 65001) ─── [RTR1 - AS 65100] ─── Enterprise LAN
ISP2 (AS 65002) ─── [RTR1]                 10.0.0.0/8
\`\`\`

## Basic eBGP Configuration (Cisco IOS-XE)

\`\`\`
router bgp 65100
 bgp router-id 203.0.113.1
 bgp log-neighbor-changes

 ! ISP1 neighbor
 neighbor 198.51.100.1 remote-as 65001
 neighbor 198.51.100.1 description ISP1-Primary
 neighbor 198.51.100.1 password ISPsecret1
 neighbor 198.51.100.1 update-source GigabitEthernet0/0

 ! ISP2 neighbor
 neighbor 198.51.100.5 remote-as 65002
 neighbor 198.51.100.5 description ISP2-Secondary
 neighbor 198.51.100.5 password ISPsecret2

 ! Advertise enterprise prefix
 network 203.0.113.0 mask 255.255.255.0
\`\`\`

## Path Selection: Prefer ISP1

Use local preference to prefer ISP1:

\`\`\`
route-map ISP1-IN permit 10
 set local-preference 200

route-map ISP2-IN permit 10
 set local-preference 100

router bgp 65100
 neighbor 198.51.100.1 route-map ISP1-IN in
 neighbor 198.51.100.5 route-map ISP2-IN in
\`\`\`

## Outbound Load Balancing

To split outbound traffic between ISPs, use AS-PATH prepending on ISP1:

\`\`\`
route-map OUT-ISP2 permit 10
 set as-path prepend 65100 65100  ! Makes ISP2 path look shorter to ISP2
\`\`\`

## Prefix Filtering (Security)

Never accept a full routing table if you don't need it. Use prefix-lists:

\`\`\`
ip prefix-list DEFAULT-ONLY seq 5 permit 0.0.0.0/0
ip prefix-list DEFAULT-ONLY seq 10 deny 0.0.0.0/0 le 32

router bgp 65100
 neighbor 198.51.100.1 prefix-list DEFAULT-ONLY in
\`\`\`

## Verification

\`\`\`
show bgp summary
show bgp ipv4 unicast 0.0.0.0
show ip route bgp
debug ip bgp 198.51.100.1 events
\`\`\``,

    contentFa: `## پیکربندی BGP برای افزونگی اینترنت سازمانی

BGP Dual-Homed به یک سازمان دو مسیر اینترنتی مستقل با Failover خودکار می‌دهد.

## توپولوژی

\`\`\`
ISP1 (AS 65001) ─── [RTR1 - AS 65100] ─── LAN سازمانی
ISP2 (AS 65002) ─── [RTR1]                 10.0.0.0/8
\`\`\`

## پیکربندی eBGP پایه (Cisco IOS-XE)

\`\`\`
router bgp 65100
 bgp router-id 203.0.113.1
 neighbor 198.51.100.1 remote-as 65001
 neighbor 198.51.100.1 description ISP1-Primary
 neighbor 198.51.100.5 remote-as 65002
 neighbor 198.51.100.5 description ISP2-Secondary
 network 203.0.113.0 mask 255.255.255.0
\`\`\`

## انتخاب مسیر: ترجیح ISP1

از Local Preference برای ترجیح ISP1 استفاده کنید:

\`\`\`
route-map ISP1-IN permit 10
 set local-preference 200

route-map ISP2-IN permit 10
 set local-preference 100

router bgp 65100
 neighbor 198.51.100.1 route-map ISP1-IN in
 neighbor 198.51.100.5 route-map ISP2-IN in
\`\`\`

## فیلترینگ Prefix (امنیت)

\`\`\`
ip prefix-list DEFAULT-ONLY seq 5 permit 0.0.0.0/0
ip prefix-list DEFAULT-ONLY seq 10 deny 0.0.0.0/0 le 32

router bgp 65100
 neighbor 198.51.100.1 prefix-list DEFAULT-ONLY in
\`\`\`

## تأیید

\`\`\`
show bgp summary
show bgp ipv4 unicast 0.0.0.0
show ip route bgp
\`\`\``,
  },

  'cisco-qos-voip-optimization': {
    contentEn: `## QoS Configuration for VoIP on Cisco Networks

VoIP traffic is delay and jitter sensitive. QoS marks, queues, and prioritizes voice packets end-to-end.

## QoS Design Model (3-tier)

\`\`\`
Access Layer: Mark traffic (DSCP EF for voice, AF41 for video)
Distribution: Queue and schedule
Core: Honor markings, minimal queuing
\`\`\`

## DSCP Markings

| Traffic | DSCP | Queue |
|---------|------|-------|
| VoIP RTP | EF (46) | Priority |
| VoIP Signaling | CS3 (24) | Expedited |
| Video Conferencing | AF41 (34) | Bandwidth |
| Business Data | AF21 (18) | Normal |
| Best Effort | BE (0) | Default |

## Classification and Marking (Access Switch)

\`\`\`
! Match VoIP phones by DSCP (phones mark themselves)
class-map match-any VOICE
 match dscp ef
 match dscp cs3

class-map match-any VIDEO
 match dscp af41

policy-map EDGE-MARKING
 class VOICE
  set dscp ef
 class VIDEO
  set dscp af41
 class class-default
  set dscp default

interface GigabitEthernet1/0/1
 service-policy input EDGE-MARKING
\`\`\`

## Queuing Policy (Router WAN interface)

\`\`\`
policy-map WAN-QOS
 class VOICE
  priority percent 20        ! LLQ — strict priority
 class VIDEO
  bandwidth percent 20
 class SIGNALING
  bandwidth percent 5
 class class-default
  fair-queue
  bandwidth percent 55

interface Serial0/0/0
 bandwidth 10000
 service-policy output WAN-QOS
\`\`\`

## MikroTik QoS for VoIP

\`\`\`bash
# Mark VoIP RTP packets
/ip firewall mangle add chain=forward src-port=10000-20000 protocol=udp action=mark-packet new-packet-mark=voip

# Queue tree priority
/queue tree add name=voip parent=global packet-mark=voip priority=1 max-limit=2M
/queue tree add name=data parent=global priority=8 max-limit=8M
\`\`\`

## Verification

\`\`\`
show policy-map interface Serial0/0/0
show queue Serial0/0/0
ping 192.168.10.50 repeat 1000 size 160
\`\`\`

Target VoIP metrics: Latency <150ms, Jitter <30ms, Packet loss <1%.`,

    contentFa: `## پیکربندی QoS برای VoIP روی شبکه‌های سیسکو

ترافیک VoIP به تأخیر و Jitter حساس است. QoS بسته‌های صوتی را علامت‌گذاری، صف‌بندی و اولویت‌بندی می‌کند.

## مدل طراحی QoS (۳ لایه)

\`\`\`
لایه دسترسی: علامت‌گذاری ترافیک (DSCP EF برای صدا)
توزیع: صف‌بندی و زمان‌بندی
هسته: رعایت علامت‌گذاری‌ها
\`\`\`

## علامت‌گذاری DSCP

| ترافیک | DSCP | صف |
|---------|------|-------|
| VoIP RTP | EF (46) | اولویت |
| سیگنالینگ VoIP | CS3 (24) | تسریع‌شده |
| کنفرانس ویدئویی | AF41 (34) | پهنای باند |
| داده تجاری | AF21 (18) | عادی |

## پالیسی صف‌بندی (رابط WAN روتر)

\`\`\`
policy-map WAN-QOS
 class VOICE
  priority percent 20        ! LLQ — اولویت سخت
 class VIDEO
  bandwidth percent 20
 class class-default
  fair-queue
  bandwidth percent 55

interface Serial0/0/0
 bandwidth 10000
 service-policy output WAN-QOS
\`\`\`

## QoS MikroTik برای VoIP

\`\`\`bash
# علامت‌گذاری بسته‌های RTP VoIP
/ip firewall mangle add chain=forward src-port=10000-20000 protocol=udp action=mark-packet new-packet-mark=voip

# اولویت درخت صف
/queue tree add name=voip parent=global packet-mark=voip priority=1 max-limit=2M
/queue tree add name=data parent=global priority=8 max-limit=8M
\`\`\`

## معیارهای هدف VoIP

تأخیر <۱۵۰ms، Jitter <۳۰ms، افت بسته <۱٪`,
  },

  'docker-enterprise-networking': {
    contentEn: `## Docker Networking for Enterprise Applications

Understanding Docker's networking models is essential for production-grade containerized applications.

## Network Driver Overview

| Driver | Use Case | Scope |
|--------|---------|-------|
| bridge | Single-host containers | Local |
| host | Performance-critical apps | Local |
| overlay | Multi-host Swarm/K8s | Swarm/cluster |
| macvlan | Containers need real IPs | Local |
| none | Isolation | Local |

## Custom Bridge Networks

\`\`\`bash
# Create isolated network
docker network create --driver bridge \
  --subnet 172.20.0.0/16 \
  --ip-range 172.20.240.0/20 \
  --gateway 172.20.0.1 \
  --opt "com.docker.network.bridge.name"="br-app" \
  app-network

# Run containers on network
docker run -d --network app-network --name web nginx
docker run -d --network app-network --name api myapi

# Containers can reach each other by name
docker exec web curl http://api:8080/health
\`\`\`

## Docker Compose Multi-Network

\`\`\`yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    networks:
      - frontend
    ports:
      - "443:443"

  api:
    image: myapp:latest
    networks:
      - frontend
      - backend

  postgres:
    image: postgres:15
    networks:
      - backend
    environment:
      POSTGRES_PASSWORD: secret

networks:
  frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/24
  backend:
    driver: bridge
    internal: true  # No external access
    ipam:
      config:
        - subnet: 172.22.0.0/24
\`\`\`

## Macvlan for Real IP Assignment

When containers need to appear as real hosts on the LAN:

\`\`\`bash
docker network create -d macvlan \
  --subnet=192.168.10.0/24 \
  --gateway=192.168.10.1 \
  --opt parent=eth0 \
  macvlan-net

docker run -d --network macvlan-net \
  --ip 192.168.10.100 \
  --name db postgres:15
\`\`\`

## Network Security

\`\`\`bash
# Disable ICC (inter-container communication) on default bridge
dockerd --icc=false

# Or in daemon.json
cat > /etc/docker/daemon.json << EOF
{
  "icc": false,
  "iptables": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
\`\`\`

## Monitoring Container Network

\`\`\`bash
# Container network stats
docker stats --format "table {{.Name}}\t{{.NetIO}}\t{{.BlockIO}}"

# Inspect network
docker network inspect app-network
\`\`\``,

    contentFa: `## شبکه‌بندی Docker برای برنامه‌های سازمانی

درک مدل‌های شبکه Docker برای برنامه‌های Containerized در سطح تولیدی ضروری است.

## مرور درایور شبکه

| درایور | کاربرد | محدوده |
|--------|---------|-------|
| bridge | کانتینرهای تک‌هاست | محلی |
| host | برنامه‌های حیاتی از نظر عملکرد | محلی |
| overlay | Swarm/K8s چند هاست | Swarm/کلاستر |
| macvlan | کانتینرها نیاز به IP واقعی دارند | محلی |

## شبکه‌های Bridge اختصاصی

\`\`\`bash
docker network create --driver bridge \
  --subnet 172.20.0.0/16 \
  --ip-range 172.20.240.0/20 \
  --gateway 172.20.0.1 \
  app-network

docker run -d --network app-network --name web nginx
docker run -d --network app-network --name api myapi

# کانتینرها می‌توانند با نام به هم دسترسی داشته باشند
docker exec web curl http://api:8080/health
\`\`\`

## Docker Compose چند شبکه

\`\`\`yaml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    networks:
      - frontend
    ports:
      - "443:443"

  postgres:
    image: postgres:15
    networks:
      - backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # بدون دسترسی خارجی
\`\`\`

## Macvlan برای IP واقعی

\`\`\`bash
docker network create -d macvlan \
  --subnet=192.168.10.0/24 \
  --gateway=192.168.10.1 \
  --opt parent=eth0 \
  macvlan-net

docker run -d --network macvlan-net --ip 192.168.10.100 postgres:15
\`\`\``,
  },

  'kubernetes-network-policies': {
    contentEn: `## Kubernetes Network Policies: Pod-Level Micro-Segmentation

By default, all pods can reach all other pods in Kubernetes. NetworkPolicy resources change this to explicit allow.

## Default Deny All

Apply this to every namespace you care about:

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}  # Selects ALL pods
  policyTypes:
    - Ingress
    - Egress
\`\`\`

## Allow Frontend to Backend

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
\`\`\`

## Allow DNS (Critical!)

Without this, pods can't resolve DNS — add it with default-deny:

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
\`\`\`

## Namespace Isolation

\`\`\`yaml
# Only allow traffic within the same namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-cross-namespace
  namespace: production
spec:
  podSelector: {}
  ingress:
    - from:
        - podSelector: {}  # Same namespace only
\`\`\`

## Database Access Control

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-access
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: postgres
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: db-client
      ports:
        - protocol: TCP
          port: 5432
\`\`\`

## Testing Network Policies

\`\`\`bash
# Deploy test pod
kubectl run test --image=busybox -it --rm -- /bin/sh

# Inside test pod
wget -qO- http://backend:8080/health  # Should work
wget -qO- http://database:5432        # Should fail
\`\`\`

Always use a CNI plugin that enforces NetworkPolicy: Calico, Cilium, or Antrea.`,

    contentFa: `## پالیسی‌های شبکه Kubernetes: میکرو-تقسیم‌بندی در سطح Pod

به‌طور پیش‌فرض، تمام Pod‌ها می‌توانند به Pod‌های دیگر در Kubernetes دسترسی داشته باشند. منابع NetworkPolicy این را به اجازه صریح تغییر می‌دهد.

## رد پیش‌فرض همه

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
\`\`\`

## اجازه Frontend به Backend

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
\`\`\`

## اجازه DNS (حیاتی!)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
\`\`\`

## آزمایش Network Policy‌ها

\`\`\`bash
kubectl run test --image=busybox -it --rm -- /bin/sh

# داخل pod آزمایشی
wget -qO- http://backend:8080/health  # باید کار کند
wget -qO- http://database:5432        # باید شکست بخورد
\`\`\`

همیشه از یک پلاگین CNI که NetworkPolicy را اجرا می‌کند استفاده کنید: Calico، Cilium یا Antrea.`,
  },

  'gitops-infrastructure-terraform': {
    contentEn: `## GitOps for Infrastructure: Terraform + Git Workflow

GitOps treats infrastructure configuration as code in Git. Every change goes through pull request, review, and automated apply.

## Project Structure

\`\`\`
infra/
├── modules/
│   ├── network/          # Reusable VPC/network module
│   ├── vm/               # VM provisioning module
│   └── firewall/         # Firewall rules module
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── production/
├── .github/workflows/
│   └── terraform.yml     # CI/CD pipeline
└── README.md
\`\`\`

## Terraform Module Example

\`\`\`hcl
# modules/network/main.tf
variable "name" { type = string }
variable "cidr" { type = string }
variable "subnets" { type = list(object({ name = string, cidr = string })) }

resource "proxmox_network" "main" {
  name    = var.name
  cidr    = var.cidr
  comment = "Managed by Terraform"
}

resource "proxmox_network_subnet" "subnets" {
  for_each = { for s in var.subnets : s.name => s }
  name     = each.value.name
  network  = proxmox_network.main.id
  cidr     = each.value.cidr
}
\`\`\`

## Remote State with Locking

\`\`\`hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "production/network/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
\`\`\`

## CI/CD Pipeline (GitHub Actions)

\`\`\`yaml
name: Terraform
on:
  pull_request:
    paths: ['infra/**']
  push:
    branches: [main]
    paths: ['infra/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: terraform init
        working-directory: infra/environments/production

      - name: Terraform Plan
        run: terraform plan -out=tfplan
        if: github.event_name == 'pull_request'

      - name: Terraform Apply
        run: terraform apply tfplan
        if: github.ref == 'refs/heads/main'
\`\`\`

## Drift Detection

\`\`\`bash
# Check for drift from desired state
terraform plan -detailed-exitcode
# Exit 0 = no changes, 1 = error, 2 = changes detected

# Run in cron for continuous compliance
0 6 * * * cd /infra/production && terraform plan -detailed-exitcode || alert "Drift detected!"
\`\`\`

## Best Practices

1. One state file per environment per component
2. Never manually change resources managed by Terraform
3. Use \`terraform import\` for existing resources
4. Tag all resources: \`managed_by = "terraform"\`, \`environment\`, \`team\`
5. Require PR approval before apply to production`,

    contentFa: `## GitOps برای زیرساخت: Terraform + Git Workflow

GitOps پیکربندی زیرساخت را به‌عنوان کد در Git می‌بیند. هر تغییر از طریق Pull Request، بازبینی و Apply خودکار می‌گذرد.

## ساختار پروژه

\`\`\`
infra/
├── modules/
│   ├── network/
│   ├── vm/
│   └── firewall/
├── environments/
│   ├── dev/
│   ├── staging/
│   └── production/
└── .github/workflows/
    └── terraform.yml
\`\`\`

## Remote State با Locking

\`\`\`hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "production/network/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
\`\`\`

## Pipeline CI/CD (GitHub Actions)

\`\`\`yaml
name: Terraform
on:
  pull_request:
    paths: ['infra/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - name: Terraform Plan
        run: terraform plan -out=tfplan
\`\`\`

## بهترین شیوه‌ها

۱. یک فایل State برای هر محیط در هر کامپوننت
۲. هرگز منابع مدیریت‌شده توسط Terraform را به‌صورت دستی تغییر ندهید
۳. برای منابع موجود از \`terraform import\` استفاده کنید
۴. همه منابع را با تگ علامت‌گذاری کنید: \`managed_by = "terraform"\`
۵. قبل از Apply به تولید، تأیید PR را الزامی کنید`,
  },

  'sd-wan-enterprise-deployment': {
    contentEn: `## SD-WAN Deployment for Multi-Branch Enterprises

SD-WAN abstracts the underlying transport (MPLS, broadband, LTE) and applies application-aware routing policies.

## SD-WAN vs Traditional WAN

| Aspect | Traditional MPLS | SD-WAN |
|--------|---------|--------|
| Cost | High | Low (uses internet) |
| Provisioning | Weeks | Hours |
| Application awareness | None | Full |
| Failover | Minutes | Sub-second |
| Centralized management | Limited | Full |

## MikroTik-Based SD-WAN Architecture

Using MikroTik with Policy-Based Routing (PBR) as a cost-effective SD-WAN alternative:

\`\`\`bash
# WAN interfaces
/interface set ether1 comment="ISP1-Primary"
/interface set ether2 comment="ISP2-Backup"
/interface set lte1 comment="LTE-Failover"

# Routing tables
/routing table add name=via-isp1 fib
/routing table add name=via-isp2 fib
/routing table add name=via-lte fib

# Default routes per table
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 routing-table=via-isp1
/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.1 routing-table=via-isp2
/ip route add dst-address=0.0.0.0/0 gateway=lte1 routing-table=via-lte
\`\`\`

## Application-Based Routing

\`\`\`bash
# VoIP via ISP1 (low latency)
/ip firewall mangle add chain=prerouting protocol=udp dst-port=10000-20000 action=mark-routing new-routing-mark=via-isp1

# Backup/bulk traffic via ISP2 (cheaper)
/ip firewall mangle add chain=prerouting dst-address-list=backup-servers action=mark-routing new-routing-mark=via-isp2

# All other traffic via ISP1 with ISP2 fallback
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 distance=1
/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.1 distance=2
\`\`\`

## Link Health Monitoring

\`\`\`bash
/ip route check-gateway=ping
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 check-gateway=ping distance=1
/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.1 check-gateway=ping distance=2
\`\`\`

## WAN Failover Testing

\`\`\`bash
# Simulate ISP1 failure
/interface disable ether1

# Verify traffic routes via ISP2
/ip route print where active

# Re-enable
/interface enable ether1
\`\`\`

## Centralized Management with Dude/Zabbix

Monitor all SD-WAN nodes centrally: track WAN link states, latency per link, failover events, and application performance.`,

    contentFa: `## استقرار SD-WAN برای سازمان‌های چند شعبه‌ای

SD-WAN انتقال زیرین (MPLS، پهنای باند، LTE) را انتزاع می‌کند و سیاست‌های مسیریابی آگاه به برنامه اعمال می‌کند.

## SD-WAN در مقابل WAN سنتی

| جنبه | MPLS سنتی | SD-WAN |
|--------|---------|--------|
| هزینه | بالا | پایین (از اینترنت استفاده می‌کند) |
| فراهم‌سازی | هفته‌ها | ساعت‌ها |
| آگاهی از برنامه | ندارد | کامل |
| Failover | دقیقه‌ها | زیر یک ثانیه |

## معماری SD-WAN مبتنی بر MikroTik

\`\`\`bash
/routing table add name=via-isp1 fib
/routing table add name=via-isp2 fib
/routing table add name=via-lte fib

/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 routing-table=via-isp1
/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.1 routing-table=via-isp2
\`\`\`

## مسیریابی مبتنی بر برنامه

\`\`\`bash
# VoIP از طریق ISP1 (تأخیر کم)
/ip firewall mangle add chain=prerouting protocol=udp dst-port=10000-20000 action=mark-routing new-routing-mark=via-isp1

# ترافیک پشتیبان از طریق ISP2 (ارزان‌تر)
/ip firewall mangle add chain=prerouting dst-address-list=backup-servers action=mark-routing new-routing-mark=via-isp2
\`\`\`

## پایش سلامت لینک

\`\`\`bash
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 check-gateway=ping distance=1
/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.1 check-gateway=ping distance=2
\`\`\``,
  },

  'backup-disaster-recovery-strategy': {
    contentEn: `## Designing a Backup & DR Strategy

A backup strategy without defined RTO/RPO targets is just hope. This guide builds a measurable, testable DR strategy.

## Define RTO and RPO First

| Term | Definition | Question |
|------|---------|---------|
| RPO | Recovery Point Objective | How much data can we afford to lose? |
| RTO | Recovery Time Objective | How long can we be down? |

Example targets by system tier:

| Tier | System | RPO | RTO |
|------|--------|-----|-----|
| Tier 1 | Core infrastructure (AD, DNS) | 1 hour | 4 hours |
| Tier 2 | Business applications | 4 hours | 8 hours |
| Tier 3 | Development/Test | 24 hours | 48 hours |

## The 3-2-1 Rule

- **3** copies of data
- **2** different media types
- **1** offsite copy

Extended 3-2-1-1-0:
- **1** air-gapped or immutable copy
- **0** errors on verified restores

## Backup Tiers Implementation

\`\`\`
Production VM
    │
    ├── Tier 1: Snapshots (every 4h, retain 48h)
    │         └── Proxmox/VMware native snapshots
    │
    ├── Tier 2: Daily incremental (retain 30 days)
    │         └── Veeam/PBS to on-site backup server
    │
    ├── Tier 3: Weekly full (retain 13 weeks)
    │         └── Veeam to off-site backup
    │
    └── Tier 4: Monthly archive (retain 7 years)
              └── Cloud storage (S3/Glacier)
\`\`\`

## Veeam Backup Configuration

\`\`\`powershell
# Create backup job
Add-VBRViBackupJob -Name "Tier2-Daily" -Server "vcenter.corp.local" \
  -Entities "VM Folder Production" \
  -BackupRepository "OnSite-Backup" \
  -BackupType Incremental \
  -RetainBackups 30 \
  -RunAfterThisJob "Tier1-Snapshots"

# Enable application-aware processing
Set-VBRJobAdvancedViOptions -Job "Tier2-Daily" -EnableVSSQuiescence $true
\`\`\`

## DR Testing Schedule

| Frequency | Test Type | Duration |
|-----------|---------|---------|
| Monthly | Single VM restore test | 2 hours |
| Quarterly | Full application stack restore | 1 day |
| Annually | Full DR failover simulation | 2 days |

## DR Runbook Template

\`\`\`markdown
# DR Runbook: [System Name]

## Contact List
- Primary: [Name] — [Phone]
- Secondary: [Name] — [Phone]
- Vendor: [Company] — [Support number]

## RTO: 4 hours | RPO: 1 hour

## Step 1: Assess Impact (30 min)
- [ ] Identify affected systems
- [ ] Determine failure cause
- [ ] Escalate if needed

## Step 2: Activate DR (1 hour)
- [ ] Access backup site
- [ ] Start restore from [backup location]
- [ ] Verify data integrity

## Step 3: Validation (1 hour)
- [ ] Test application functionality
- [ ] Notify stakeholders
\`\`\`

Document, test, and update runbooks after every DR event.`,

    contentFa: `## طراحی استراتژی پشتیبان‌گیری و DR

یک استراتژی پشتیبان‌گیری بدون اهداف مشخص RTO/RPO فقط امید است.

## ابتدا RTO و RPO را تعریف کنید

| اصطلاح | تعریف | سوال |
|------|---------|---------|
| RPO | هدف نقطه بازیابی | چقدر داده می‌توانیم از دست بدهیم؟ |
| RTO | هدف زمان بازیابی | چقدر می‌توانیم متوقف باشیم؟ |

نمونه اهداف بر اساس لایه سیستم:

| لایه | سیستم | RPO | RTO |
|------|--------|-----|-----|
| لایه ۱ | زیرساخت هسته (AD، DNS) | ۱ ساعت | ۴ ساعت |
| لایه ۲ | برنامه‌های تجاری | ۴ ساعت | ۸ ساعت |
| لایه ۳ | توسعه/آزمایش | ۲۴ ساعت | ۴۸ ساعت |

## قانون ۳-۲-۱

- **۳** نسخه از داده
- **۲** نوع رسانه مختلف
- **۱** نسخه برون‌سازمانی

## لایه‌های پشتیبان‌گیری

\`\`\`
VM تولیدی
    ├── لایه ۱: Snapshot (هر ۴ ساعت، نگهداری ۴۸ ساعت)
    ├── لایه ۲: روزانه افزایشی (نگهداری ۳۰ روز)
    ├── لایه ۳: هفتگی کامل (نگهداری ۱۳ هفته)
    └── لایه ۴: آرشیو ماهانه (نگهداری ۷ سال)
\`\`\`

## برنامه آزمایش DR

| فرکانس | نوع آزمایش | مدت |
|-----------|---------|---------|
| ماهانه | آزمایش بازیابی VM واحد | ۲ ساعت |
| فصلی | بازیابی کامل استک برنامه | ۱ روز |
| سالانه | شبیه‌سازی Failover کامل DR | ۲ روز |

مستندات را بعد از هر رویداد DR به‌روزرسانی کنید.`,
  },

  'network-documentation-best-practices': {
    contentEn: `## Network Documentation Best Practices

Good documentation is the difference between a 2-hour fix and a 2-day outage. These are the essentials.

## What to Document

1. **Network topology diagrams** (L1, L2, L3)
2. **IP address management (IPAM)**
3. **Device inventory** with firmware versions
4. **Configuration baselines**
5. **Change log**
6. **Runbooks** for common procedures

## Topology Diagram Layers

**Layer 1 (Physical):**
- Which cable goes where
- Patch panel numbering
- Rack diagrams with U positions

**Layer 2 (Logical):**
- VLAN assignments
- Switch port to device mapping
- Trunk links

**Layer 3 (IP):**
- Subnets and gateway IPs
- Routing protocols and neighbors
- Static routes

Use draw.io (free), Visio, or Lucidchart. Export as SVG for version control.

## IPAM in Spreadsheet Format

\`\`\`
| Network       | VLAN | Gateway      | Purpose     | DHCP Range               |
|---------------|------|--------------|-------------|--------------------------|
| 10.10.0.0/24  | 10   | 10.10.0.1    | Management  | Static only              |
| 10.10.1.0/24  | 20   | 10.10.1.1    | Corporate   | 10.10.1.100-10.10.1.200  |
| 10.10.2.0/24  | 30   | 10.10.2.1    | Guest WiFi  | 10.10.2.10-10.10.2.250   |
| 10.10.3.0/24  | 40   | 10.10.3.1    | Servers     | Static only              |
| 10.10.4.0/24  | 50   | 10.10.4.1    | VoIP        | 10.10.4.10-10.10.4.100   |
\`\`\`

## Device Inventory

\`\`\`
| Hostname | IP          | Type    | Model          | Firmware | Location    | Notes        |
|----------|-------------|---------|----------------|----------|-------------|--------------|
| rtr-hq   | 10.10.0.1   | Router  | RB4011iGS+RM   | 7.14.2   | HQ-Rack1-U1 | Core router  |
| sw-core  | 10.10.0.2   | Switch  | CRS354-48G     | 7.14.2   | HQ-Rack1-U2 | Core switch  |
| fw-hq    | 10.10.0.3   | Firewall| FG-200F        | 7.4.3    | HQ-Rack1-U4 | Edge FW      |
\`\`\`

## Change Log Format

\`\`\`markdown
## 2025-06-15 — VLAN 50 Added for VoIP

**Changed by:** H. Habibazar  
**Approved by:** IT Manager  
**Ticket:** IT-1234  

**Changes made:**
- Added VLAN 50 on all switches (sw-core, sw-access-1, sw-access-2)
- Configured DHCP scope 10.10.4.10-100 on rtr-hq
- Updated IP phones to receive VLAN 50 LLDP-MED config
- Added QoS markings for DSCP EF on VoIP traffic

**Rollback procedure:**
- Remove VLAN 50 from all switches
- Delete DHCP scope
\`\`\`

## Tools Recommendation

- **Free**: draw.io + GitHub/GitLab for version control
- **IPAM**: phpIPAM (self-hosted, free)
- **Wiki**: Outline, Notion, or Confluence
- **Network config backup**: Oxidized (free, auto-backup via SNMP/SSH)`,

    contentFa: `## بهترین شیوه‌های مستندسازی شبکه

مستندات خوب تفاوت بین رفع ۲ ساعته و قطعی ۲ روزه است.

## چه چیزی را مستند کنید

۱. **نمودارهای توپولوژی شبکه** (L1، L2، L3)
۲. **مدیریت آدرس IP (IPAM)**
۳. **موجودی دستگاه‌ها** با نسخه‌های فریم‌ور
۴. **خطوط پایه پیکربندی**
۵. **لاگ تغییرات**
۶. **Runbook‌ها** برای روش‌های رایج

## IPAM در قالب صفحه‌گسترده

\`\`\`
| شبکه          | VLAN | Gateway      | هدف     | محدوده DHCP               |
|---------------|------|--------------|-------------|--------------------------|
| 10.10.0.0/24  | 10   | 10.10.0.1    | مدیریت  | فقط Static               |
| 10.10.1.0/24  | 20   | 10.10.1.1    | سازمانی | 10.10.1.100-10.10.1.200  |
| 10.10.2.0/24  | 30   | 10.10.2.1    | WiFi مهمان | 10.10.2.10-10.10.2.250  |
\`\`\`

## فرمت لاگ تغییرات

\`\`\`markdown
## ۱۴۰۴/۰۳/۲۵ — VLAN 50 برای VoIP اضافه شد

**تغییر داده شده توسط:** ح. حبی‌بازار  
**تأیید شده توسط:** مدیر IT  

**تغییرات انجام‌شده:**
- افزودن VLAN 50 روی تمام سوئیچ‌ها
- پیکربندی محدوده DHCP 10.10.4.10-100

**رویه Rollback:**
- حذف VLAN 50 از تمام سوئیچ‌ها
- حذف محدوده DHCP
\`\`\`

## توصیه ابزارها

- **رایگان**: draw.io + GitHub برای کنترل نسخه
- **IPAM**: phpIPAM (خود-میزبانی، رایگان)
- **ویکی**: Outline، Notion یا Confluence
- **پشتیبان‌گیری از پیکربندی شبکه**: Oxidized (رایگان، پشتیبان‌گیری خودکار)`,
  },

  'voip-asterisk-enterprise': {
    contentEn: `## Enterprise VoIP with Asterisk FreePBX

Asterisk FreePBX is the most deployed open-source PBX. This guide covers a production deployment with SIP trunks, IVR, and call queues.

## Installation (Ubuntu 22.04)

\`\`\`bash
# FreePBX installer
wget https://github.com/FreePBX/sng_freepbx_debian_install/raw/master/sng_freepbx_debian_install.sh
chmod +x sng_freepbx_debian_install.sh
sudo bash ./sng_freepbx_debian_install.sh
\`\`\`

## SIP Trunk Configuration

In FreePBX Admin → Connectivity → Trunks → Add SIP Trunk:

\`\`\`
Trunk Name: ISP-SIP-Trunk
Peer Details:
  host=sip.yourprovider.com
  type=friend
  secret=SIPpassword123
  context=from-trunk
  dtmfmode=rfc2833
  disallow=all
  allow=ulaw,alaw,g729
  qualify=yes
  nat=force_rport,comedia

Registration String:
  1234567890:SIPpassword123@sip.yourprovider.com/1234567890
\`\`\`

## Extensions (PJSIP)

\`\`\`
Extension: 1001
Display Name: Reception
Secret: SecurePass123!
Max Contacts: 1
Transport: UDP
\`\`\`

## IVR Configuration

\`\`\`
IVR Name: Main-Menu
Announcement: "Welcome to HBZ. Press 1 for Sales, 2 for Support, 0 for Reception"
Timeout: 10 seconds
Digit timeout: 5 seconds

Options:
  1 → Ring Group: Sales-Team (ext 1100-1105)
  2 → Queue: Support-Queue
  0 → Extension: 1001 (Reception)
  t → Repeat IVR
  i → Repeat IVR
\`\`\`

## Call Queues

\`\`\`
Queue Name: Support-Queue
Strategy: ringall (or leastrecent for larger teams)
Ring time: 20 seconds
Max wait time: 300 seconds
Members: 1010, 1011, 1012, 1013
Hold music: default
Periodic announce: "You are caller number {{QUEUE_POSITION}}. Please hold."
Announce position: yes
\`\`\`

## Call Recording

\`\`\`bash
# Enable in FreePBX: Admin → Call Recording
# Records stored at: /var/spool/asterisk/monitor/

# Retention cleanup (cron - delete after 90 days)
0 2 * * * find /var/spool/asterisk/monitor/ -name "*.wav" -mtime +90 -delete
\`\`\`

## Firewall Rules for FreePBX

\`\`\`bash
ufw allow from sip.yourprovider.com to any port 5060 proto udp
ufw allow 10000:20000/udp  # RTP media
ufw allow 80/tcp           # FreePBX admin (change to internal only!)
ufw allow 443/tcp
\`\`\`

## Monitoring

\`\`\`bash
# Active calls
asterisk -rx "core show channels"

# SIP registrations
asterisk -rx "pjsip show registrations"

# Queue status
asterisk -rx "queue show Support-Queue"
\`\`\``,

    contentFa: `## VoIP سازمانی با Asterisk FreePBX

Asterisk FreePBX پرکاربردترین PBX متن‌باز است. این راهنما یک استقرار تولیدی با SIP Trunk، IVR و صف تماس را پوشش می‌دهد.

## نصب (Ubuntu 22.04)

\`\`\`bash
wget https://github.com/FreePBX/sng_freepbx_debian_install/raw/master/sng_freepbx_debian_install.sh
chmod +x sng_freepbx_debian_install.sh
sudo bash ./sng_freepbx_debian_install.sh
\`\`\`

## پیکربندی SIP Trunk

\`\`\`
نام Trunk: ISP-SIP-Trunk
جزئیات Peer:
  host=sip.yourprovider.com
  secret=SIPpassword123
  dtmfmode=rfc2833
  disallow=all
  allow=ulaw,alaw,g729
\`\`\`

## پیکربندی IVR

\`\`\`
نام IVR: Main-Menu
اعلان: "به HBZ خوش آمدید. برای فروش ۱، پشتیبانی ۲، پذیرش ۰ بفشارید"
گزینه‌ها:
  ۱ → گروه زنگ: تیم فروش
  ۲ → صف: صف پشتیبانی
  ۰ → داخلی: پذیرش
\`\`\`

## صف‌های تماس

\`\`\`
نام صف: Support-Queue
استراتژی: ringall
زمان انتظار حداکثر: ۳۰۰ ثانیه
اعضا: 1010، 1011، 1012، 1013
\`\`\`

## قوانین فایروال برای FreePBX

\`\`\`bash
ufw allow from sip.yourprovider.com to any port 5060 proto udp
ufw allow 10000:20000/udp  # رسانه RTP
\`\`\`

## پایش

\`\`\`bash
asterisk -rx "core show channels"
asterisk -rx "pjsip show registrations"
asterisk -rx "queue show Support-Queue"
\`\`\``,
  },

  'network-capacity-planning': {
    contentEn: `## Network Capacity Planning: Methodology and Tools

Proactive capacity planning prevents outages before they happen. This is the methodology for enterprise networks.

## Step 1: Establish Baselines

Collect at least 90 days of data before planning. Key metrics:

\`\`\`
Per Interface:
- Inbound/Outbound utilization (avg, 95th percentile, peak)
- Error rate (input/output errors per hour)
- Drops (queue drops)

Per Device:
- CPU utilization (avg, peak)
- Memory utilization
- BGP prefix counts (if applicable)

Per Site:
- WAN utilization (daily pattern)
- User count trend
\`\`\`

## Traffic Analysis with NTOPNG

\`\`\`bash
# Install ntopng
apt install ntopng

# Configure to monitor interface
# /etc/ntopng/ntopng.conf
--interface=ether1
--http-port=3000
--community

systemctl enable --now ntopng
\`\`\`

## Utilization Thresholds

| Threshold | Action |
|---------|---------|
| 50% | Plan capacity upgrade |
| 70% | Begin procurement process |
| 80% | Implement QoS/traffic shaping |
| 90% | Emergency upgrade (if no plan) |

Note: Use **95th percentile**, not average. Average hides bursty traffic.

## Growth Modeling

\`\`\`python
import numpy as np

# Monthly bandwidth usage (GB)
history = [120, 135, 142, 158, 170, 185]

# Linear regression forecast
months = np.arange(len(history))
z = np.polyfit(months, history, 1)
p = np.poly1d(z)

for m in range(6, 18):  # Next 12 months
    forecast = p(m)
    print(f"Month {m}: {forecast:.0f} GB")
\`\`\`

## WAN Capacity Planning Worksheet

\`\`\`
Current WAN speed: 100 Mbps
Current 95th percentile utilization: 72 Mbps (72%)
Monthly growth rate: 8%

Month 1: 77.8 Mbps (78%)
Month 2: 84.0 Mbps (84%) ← Needs upgrade
Month 3: 90.7 Mbps (91%) ← Emergency territory
\`\`\`

## Procurement Timeline

Work backwards from the capacity threshold:

- **Month 0**: Order placed (today)
- **Month 1-2**: Procurement/vendor lead time
- **Month 2-3**: Installation and testing
- **Month 3**: Live at new capacity

Start process when utilization hits 50%, not 90%.

## Reporting Template

Produce monthly capacity reports with:
- Current utilization by site/interface
- Trend chart (6 months)
- Forecast to 80% threshold date
- Recommended action and timeline`,

    contentFa: `## برنامه‌ریزی ظرفیت شبکه: روش‌شناسی و ابزارها

برنامه‌ریزی ظرفیت پیشگیرانه قبل از وقوع، از قطعی‌ها جلوگیری می‌کند.

## مرحله ۱: ایجاد خطوط پایه

حداقل ۹۰ روز داده قبل از برنامه‌ریزی جمع‌آوری کنید. معیارهای کلیدی:

\`\`\`
به ازای هر رابط:
- استفاده ورودی/خروجی (میانگین، صدک ۹۵، اوج)
- نرخ خطا
- افت (Drop‌های صف)

به ازای هر دستگاه:
- استفاده از CPU
- استفاده از حافظه

به ازای هر سایت:
- استفاده از WAN (الگوی روزانه)
- روند تعداد کاربر
\`\`\`

## آستانه‌های استفاده

| آستانه | اقدام |
|---------|---------|
| ۵۰٪ | برنامه‌ریزی ارتقاء ظرفیت |
| ۷۰٪ | شروع فرآیند تأمین |
| ۸۰٪ | پیاده‌سازی QoS/Traffic Shaping |
| ۹۰٪ | ارتقاء اضطراری |

توجه: از **صدک ۹۵** استفاده کنید، نه میانگین. میانگین ترافیک انفجاری را پنهان می‌کند.

## مدل‌سازی رشد

\`\`\`python
import numpy as np

# استفاده ماهانه پهنای باند (GB)
history = [120, 135, 142, 158, 170, 185]

months = np.arange(len(history))
z = np.polyfit(months, history, 1)
p = np.poly1d(z)

for m in range(6, 18):
    forecast = p(m)
    print(f"ماه {m}: {forecast:.0f} GB")
\`\`\`

## جدول زمانی تأمین

وقتی استفاده به ۵۰٪ رسید فرآیند را شروع کنید، نه ۹۰٪.

گزارش‌های ظرفیت ماهانه تولید کنید با:
- استفاده فعلی بر اساس سایت/رابط
- نمودار روند (۶ ماه)
- پیش‌بینی تاریخ رسیدن به آستانه ۸۰٪`,
  },

  'full-blog-platform-search-rss': {
    contentEn: `## Building a Complete Blog Platform: Search, Filtering, Code Highlighting & RSS Feed

This post covers the architecture and implementation of the blog platform powering this very site — built with Next.js 15, Drizzle ORM, SQLite, and Shiki.

## Tech Stack

| Component | Technology |
|-----------|---------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite + Drizzle ORM |
| Search | Full-text search via SQLite FTS5 |
| Code highlighting | Shiki (server-side) |
| RSS | Custom XML generator |
| Styling | Tailwind CSS |

## Database Schema

\`\`\`typescript
// schema.ts
export const blogPosts = sqliteTable('blog_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa').notNull(),
  contentEn: text('content_en'),
  contentFa: text('content_fa'),
  categoryId: integer('category_id').references(() => blogCategories.id),
  status: text('status').default('draft'),
  featured: integer('featured').default(0),
  publishedAtEn: text('published_at_en'),
})
\`\`\`

## Full-Text Search with SQLite FTS5

\`\`\`sql
-- Create virtual FTS table
CREATE VIRTUAL TABLE blog_fts USING fts5(
  slug UNINDEXED,
  title_en,
  title_fa,
  excerpt_en,
  excerpt_fa,
  content_en,
  content_fa,
  content='blog_posts',
  content_rowid='id'
);

-- Trigger to keep FTS in sync
CREATE TRIGGER blog_posts_ai AFTER INSERT ON blog_posts BEGIN
  INSERT INTO blog_fts(rowid, slug, title_en, title_fa, excerpt_en, excerpt_fa, content_en, content_fa)
  VALUES (new.id, new.slug, new.title_en, new.title_fa, new.excerpt_en, new.excerpt_fa, new.content_en, new.content_fa);
END;
\`\`\`

\`\`\`typescript
// Search API
export async function searchPosts(query: string, locale: string) {
  const db = getDb()
  const results = db.prepare(\`
    SELECT bp.slug, bp.title_en, bp.title_fa, bp.excerpt_en, bp.excerpt_fa,
           rank
    FROM blog_fts 
    JOIN blog_posts bp ON bp.id = blog_fts.rowid
    WHERE blog_fts MATCH ?
      AND bp.status = 'published'
    ORDER BY rank
    LIMIT 20
  \`).all(\`\${query}*\`)
  return results
}
\`\`\`

## Code Highlighting with Shiki

\`\`\`typescript
import { codeToHtml } from 'shiki'
import { visit } from 'unist-util-visit'

export async function highlightCode(tree: Root) {
  const nodes: [Code, Parent, number][] = []
  
  visit(tree, 'code', (node: Code, index, parent: Parent) => {
    nodes.push([node, parent, index as number])
  })

  await Promise.all(nodes.map(async ([node, parent, index]) => {
    const html = await codeToHtml(node.value, {
      lang: node.lang || 'text',
      theme: 'github-dark',
    })
    parent.children.splice(index, 1, {
      type: 'html',
      value: html,
    })
  }))
}
\`\`\`

## Category Filtering

\`\`\`typescript
// app/[locale]/blog/page.tsx
export default async function BlogPage({ searchParams }: { searchParams: { category?: string } }) {
  const db = getDb()
  const posts = db.prepare(\`
    SELECT bp.*, bc.name_en as cat_en, bc.name_fa as cat_fa
    FROM blog_posts bp
    LEFT JOIN blog_categories bc ON bc.id = bp.category_id
    WHERE bp.status = 'published'
      \${searchParams.category ? 'AND bc.slug = ?' : ''}
    ORDER BY bp.id DESC
  \`).all(...(searchParams.category ? [searchParams.category] : []))

  return <BlogList posts={posts} />
}
\`\`\`

## RSS Feed Generation

\`\`\`typescript
// app/rss.xml/route.ts
export async function GET() {
  const db = getDb()
  const posts = db.prepare(\`
    SELECT * FROM blog_posts WHERE status = 'published' ORDER BY id DESC LIMIT 50
  \`).all() as BlogPost[]

  const rss = \`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>HBZ Blog — Infrastructure Engineering</title>
    <link>https://habibazar.ir/en/blog</link>
    <description>Network, Security, and Infrastructure insights</description>
    <atom:link href="https://habibazar.ir/rss.xml" rel="self" type="application/rss+xml"/>
    \${posts.map(p => \`
    <item>
      <title>\${p.title_en}</title>
      <link>https://habibazar.ir/en/blog/\${p.slug}</link>
      <description>\${p.excerpt_en}</description>
      <pubDate>\${new Date(p.created_at).toUTCString()}</pubDate>
      <guid>https://habibazar.ir/en/blog/\${p.slug}</guid>
    </item>
    \`).join('')}
  </channel>
</rss>\`

  return new Response(rss, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  })
}
\`\`\`

## Reading Time Calculation

\`\`\`typescript
export function calculateReadTime(content: string, locale: 'en' | 'fa'): string {
  const wpm = locale === 'fa' ? 200 : 238  // Persian readers slightly slower
  const words = content.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wpm)
  return locale === 'fa' ? \`\${minutes} دقیقه مطالعه\` : \`\${minutes} min read\`
}
\`\`\`

This platform serves this blog in both English and Farsi, with full RTL support, shared content storage, and a single admin interface.`,

    contentFa: `## ساخت پلتفرم کامل وبلاگ: جستجو، فیلترینگ، هایلایت کد و فید RSS

این پست معماری و پیاده‌سازی پلتفرم وبلاگ که همین سایت را تامین می‌کند پوشش می‌دهد — ساخته‌شده با Next.js 15، Drizzle ORM، SQLite و Shiki.

## استک فناوری

| کامپوننت | فناوری |
|-----------|---------|
| فریم‌ورک | Next.js 15 (App Router) |
| پایگاه‌داده | SQLite + Drizzle ORM |
| جستجو | جستجوی متن کامل از طریق SQLite FTS5 |
| هایلایت کد | Shiki (سمت سرور) |
| RSS | تولیدکننده XML اختصاصی |
| استایل | Tailwind CSS |

## اسکیمای پایگاه‌داده

\`\`\`typescript
export const blogPosts = sqliteTable('blog_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa').notNull(),
  contentEn: text('content_en'),
  contentFa: text('content_fa'),
  status: text('status').default('draft'),
})
\`\`\`

## جستجوی متن کامل با SQLite FTS5

\`\`\`sql
CREATE VIRTUAL TABLE blog_fts USING fts5(
  slug UNINDEXED,
  title_en, title_fa,
  excerpt_en, excerpt_fa,
  content_en, content_fa,
  content='blog_posts',
  content_rowid='id'
);
\`\`\`

## هایلایت کد با Shiki

\`\`\`typescript
import { codeToHtml } from 'shiki'

const html = await codeToHtml(node.value, {
  lang: node.lang || 'text',
  theme: 'github-dark',
})
\`\`\`

## تولید فید RSS

\`\`\`typescript
// app/rss.xml/route.ts
export async function GET() {
  const posts = db.prepare(\`
    SELECT * FROM blog_posts WHERE status = 'published' ORDER BY id DESC LIMIT 50
  \`).all()

  const rss = \`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>وبلاگ HBZ — مهندسی زیرساخت</title>
    \${posts.map(p => \`<item>
      <title>\${p.title_fa}</title>
      <link>https://habibazar.ir/fa/blog/\${p.slug}</link>
    </item>\`).join('')}
  </channel>
</rss>\`

  return new Response(rss, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  })
}
\`\`\`

این پلتفرم این وبلاگ را به هر دو زبان انگلیسی و فارسی ارائه می‌دهد، با پشتیبانی کامل RTL، ذخیره‌سازی محتوای مشترک و یک رابط مدیریتی واحد.`,
  },
  'mikrotik-bandwidth-management': {
    contentEn: `## Introduction

Bandwidth management on MikroTik RouterOS is one of the most powerful features available to network engineers. Whether you're managing a small office or an ISP with thousands of clients, MikroTik's queue system gives you granular control over traffic shaping, prioritization, and rate limiting.

## Understanding MikroTik Queue Types

MikroTik has two main queue mechanisms:

1. **Simple Queues** — Easy to configure, great for per-client rate limiting
2. **Queue Tree** — Advanced, policy-based shaping using mangle marks

## Simple Queue: Per-Client Rate Limiting

The simplest use case: limit a specific IP to 10 Mbps download and 2 Mbps upload.

\`\`\`bash
/queue simple add name="Client-192.168.1.100" target=192.168.1.100/32 max-limit=10M/2M
\`\`\`

For a DHCP-based network with many clients:

\`\`\`bash
/queue simple add name="Office-Clients" target=192.168.1.0/24 max-limit=100M/20M
\`\`\`

## Queue Tree with Mangle: Advanced Traffic Shaping

Queue Tree requires marking packets with mangle first, then shaping based on marks.

### Step 1: Mark connections with mangle

\`\`\`bash
/ip firewall mangle
add chain=forward src-address=192.168.1.0/24 out-interface=ether1 action=mark-connection new-connection-mark=LAN-out passthrough=yes
add chain=forward connection-mark=LAN-out action=mark-packet new-packet-mark=LAN-out-pkt passthrough=no
\`\`\`

### Step 2: Create parent queue on WAN interface

\`\`\`bash
/queue tree
add name="WAN-Out" parent=ether1 max-limit=100M packet-mark=""
\`\`\`

### Step 3: Add child queues with priority

\`\`\`bash
/queue tree
add name="VoIP" parent=WAN-Out packet-mark=LAN-out-pkt priority=1 max-limit=10M limit-at=2M
add name="HTTP" parent=WAN-Out packet-mark=LAN-out-pkt priority=4 max-limit=80M limit-at=20M
add name="P2P" parent=WAN-Out packet-mark=LAN-out-pkt priority=8 max-limit=20M limit-at=1M
\`\`\`

## PCQ: Per-Connection Queuing for ISPs

PCQ (Per Connection Queue) is perfect for ISPs who need fair bandwidth distribution among many clients without creating individual queues.

\`\`\`bash
/queue type
add name="PCQ-Download" kind=pcq pcq-classifier=dst-address pcq-rate=2M pcq-limit=50 pcq-total-limit=2000
add name="PCQ-Upload" kind=pcq pcq-classifier=src-address pcq-rate=512k pcq-limit=50 pcq-total-limit=2000
\`\`\`

Apply the PCQ queues:

\`\`\`bash
/queue tree
add name="Download-PCQ" parent=bridge1 queue=PCQ-Download
add name="Upload-PCQ" parent=ether1 queue=PCQ-Upload
\`\`\`

## Burst Configuration

Burst allows clients to temporarily exceed their limit — great for web browsing feel:

\`\`\`bash
/queue simple
add name="Client-Burst" target=192.168.1.50/32   max-limit=10M/2M   burst-limit=20M/4M   burst-threshold=8M/1.5M   burst-time=10s/10s
\`\`\`

This means: normally 10M, burst to 20M for 10 seconds when average is below 8M.

## Monitoring Queue Statistics

\`\`\`bash
# View queue stats live
/queue simple print stats

# Monitor specific queue
/queue simple monitor [find name="Client-192.168.1.100"]
\`\`\`

## Practical ISP Setup Example

For an ISP with 100 clients each getting 10M/2M:

\`\`\`bash
# Create PCQ types
/queue type
add name=pcq-dl kind=pcq pcq-rate=10M pcq-classifier=dst-address
add name=pcq-ul kind=pcq pcq-rate=2M pcq-classifier=src-address

# Mark traffic
/ip firewall mangle
add chain=forward in-interface=ether1-WAN action=mark-packet new-packet-mark=from-wan passthrough=no
add chain=forward out-interface=ether1-WAN action=mark-packet new-packet-mark=to-wan passthrough=no

# Apply queues
/queue tree
add name=Download parent=bridge-LAN packet-mark=from-wan queue=pcq-dl
add name=Upload parent=ether1-WAN packet-mark=to-wan queue=pcq-ul
\`\`\`

## Troubleshooting

\`\`\`bash
# Check if packets are being queued
/queue simple print stats detail

# See dropped packets (high drops = queue full = client is over limit)
/interface print stats where name=ether1

# Torch tool for live traffic monitoring
/tool torch interface=ether1 src-address=192.168.1.100
\`\`\`

## Best Practices

1. Always set \`limit-at\` (guaranteed rate) as well as \`max-limit\` in Queue Tree
2. Use PCQ for large deployments — don't create 1000 simple queues
3. Place queues on the correct interface direction (in/out)
4. Use burst sparingly — it can mask underlying bandwidth issues
5. Monitor queue drops to detect congestion before users complain`,
    contentFa: `## مقدمه

مدیریت پهنای باند در MikroTik RouterOS یکی از قدرتمندترین ویژگی‌های موجود برای مهندسان شبکه است. سیستم صف MikroTik کنترل دقیق ترافیک، اولویت‌بندی و محدودسازی نرخ را فراهم می‌کند.

## انواع صف در MikroTik

دو مکانیزم اصلی صف در MikroTik وجود دارد:

1. **Simple Queues** — پیکربندی آسان، مناسب محدودسازی هر کلاینت
2. **Queue Tree** — پیشرفته، مبتنی بر علامت‌گذاری mangle

## Simple Queue: محدودسازی هر کلاینت

ساده‌ترین حالت: محدود کردن یک IP به ۱۰ مگابیت دانلود و ۲ مگابیت آپلود:

\`\`\`bash
/queue simple add name="Client-192.168.1.100" target=192.168.1.100/32 max-limit=10M/2M
\`\`\`

## Queue Tree با Mangle

Queue Tree نیاز به علامت‌گذاری بسته‌ها با mangle دارد:

\`\`\`bash
# مرحله ۱: علامت‌گذاری اتصالات
/ip firewall mangle
add chain=forward src-address=192.168.1.0/24 out-interface=ether1 action=mark-connection new-connection-mark=LAN-out passthrough=yes
add chain=forward connection-mark=LAN-out action=mark-packet new-packet-mark=LAN-out-pkt passthrough=no

# مرحله ۲: صف والد روی رابط WAN
/queue tree
add name="WAN-Out" parent=ether1 max-limit=100M

# مرحله ۳: صف‌های فرزند با اولویت
/queue tree
add name="VoIP" parent=WAN-Out packet-mark=LAN-out-pkt priority=1 max-limit=10M limit-at=2M
add name="HTTP" parent=WAN-Out packet-mark=LAN-out-pkt priority=4 max-limit=80M limit-at=20M
add name="P2P" parent=WAN-Out packet-mark=LAN-out-pkt priority=8 max-limit=20M limit-at=1M
\`\`\`

## PCQ: برای ارائه‌دهندگان اینترنت

PCQ برای توزیع عادلانه پهنای باند بین کلاینت‌های زیاد ایده‌آل است:

\`\`\`bash
/queue type
add name="PCQ-Download" kind=pcq pcq-classifier=dst-address pcq-rate=2M pcq-limit=50
add name="PCQ-Upload" kind=pcq pcq-classifier=src-address pcq-rate=512k pcq-limit=50
\`\`\`

## پیکربندی Burst

Burst به کلاینت‌ها اجازه می‌دهد موقتاً از محدودیت فراتر روند:

\`\`\`bash
/queue simple
add name="Client-Burst" target=192.168.1.50/32   max-limit=10M/2M   burst-limit=20M/4M   burst-threshold=8M/1.5M   burst-time=10s/10s
\`\`\`

## نظارت بر آمار صف

\`\`\`bash
/queue simple print stats
/tool torch interface=ether1 src-address=192.168.1.100
\`\`\`

## بهترین روش‌ها

1. همیشه \`limit-at\` را در Queue Tree تنظیم کنید
2. برای استقرارهای بزرگ از PCQ استفاده کنید
3. صف‌ها را روی جهت صحیح رابط قرار دهید
4. Burst را با احتیاط استفاده کنید
5. افت صف را برای تشخیص ازدحام پیش از شکایت کاربران پایش کنید`,
  },
  'mikrotik-wireguard-vpn': {
    contentEn: `## Introduction

WireGuard is a modern, high-performance VPN protocol that was added to MikroTik RouterOS 7.x natively. It's far simpler to configure than OpenVPN or IPSec, uses state-of-the-art cryptography, and delivers excellent throughput.

## Prerequisites

- MikroTik RouterOS 7.1 or later
- Public IP on the MikroTik router (or port forwarding)
- WireGuard client app on endpoints

## Step 1: Enable WireGuard on RouterOS

\`\`\`bash
# Add WireGuard interface
/interface wireguard
add name=wg0 listen-port=13231 mtu=1420

# View the auto-generated public key (share this with peers)
/interface wireguard print
\`\`\`

Note the \`public-key\` value — you'll need to give this to each peer.

## Step 2: Assign IP to the WireGuard Interface

\`\`\`bash
/ip address add address=10.200.0.1/24 interface=wg0
\`\`\`

## Step 3: Generate Client Keys

On a Linux machine or WireGuard app:

\`\`\`bash
wg genkey | tee client_private.key | wg pubkey > client_public.key
cat client_private.key  # keep this SECRET
cat client_public.key   # give this to RouterOS
\`\`\`

## Step 4: Add Peer on RouterOS

\`\`\`bash
/interface wireguard peers
add interface=wg0   public-key="CLIENT_PUBLIC_KEY_HERE"   allowed-address=10.200.0.2/32   comment="Laptop-John"
\`\`\`

## Step 5: Configure Firewall

\`\`\`bash
# Allow WireGuard UDP port
/ip firewall filter
add chain=input protocol=udp dst-port=13231 action=accept comment="WireGuard"

# Allow traffic from WireGuard subnet
add chain=input src-address=10.200.0.0/24 action=accept
add chain=forward src-address=10.200.0.0/24 action=accept
add chain=forward dst-address=10.200.0.0/24 action=accept
\`\`\`

## Step 6: Client Configuration File

Create a config file for the client:

\`\`\`ini
[Interface]
PrivateKey = CLIENT_PRIVATE_KEY_HERE
Address = 10.200.0.2/24
DNS = 8.8.8.8

[Peer]
PublicKey = MIKROTIK_PUBLIC_KEY_HERE
Endpoint = YOUR_PUBLIC_IP:13231
AllowedIPs = 192.168.1.0/24, 10.200.0.0/24
PersistentKeepalive = 25
\`\`\`

## Site-to-Site WireGuard

For connecting two MikroTik sites:

**Site A (10.10.1.0/24):**
\`\`\`bash
/interface wireguard
add name=wg-site-b listen-port=13232 mtu=1420

/ip address add address=10.99.0.1/30 interface=wg-site-b

/interface wireguard peers
add interface=wg-site-b   public-key="SITE_B_PUBLIC_KEY"   endpoint-address=SITE_B_PUBLIC_IP   endpoint-port=13232   allowed-address=10.10.2.0/24,10.99.0.2/32   persistent-keepalive=25
\`\`\`

Add static routes for the remote network:

\`\`\`bash
/ip route add dst-address=10.10.2.0/24 gateway=wg-site-b
\`\`\`

## Monitoring WireGuard

\`\`\`bash
# Check peer handshake status
/interface wireguard peers print
# "last-handshake" should be recent (within 3 minutes)

# Traffic counters
/interface wireguard peers print stats
\`\`\`

## Performance Tips

1. WireGuard uses ChaCha20-Poly1305 — extremely fast on ARM CPUs
2. Set MTU to 1420 to avoid fragmentation over most internet connections
3. \`PersistentKeepalive=25\` keeps NAT mappings alive for mobile clients
4. WireGuard is connectionless — there's no "connect/disconnect" state; just check \`last-handshake\`
5. For road warriors, use \`AllowedIPs = 0.0.0.0/0\` to route all traffic through the VPN`,
    contentFa: `## مقدمه

WireGuard یک پروتکل VPN مدرن و پرسرعت است که به صورت بومی به MikroTik RouterOS 7.x اضافه شده است. پیکربندی آن نسبت به OpenVPN یا IPSec بسیار ساده‌تر است و کارایی عالی دارد.

## پیش‌نیازها

- MikroTik RouterOS نسخه ۷.۱ یا بالاتر
- IP عمومی روی روتر MikroTik

## مرحله ۱: فعال‌سازی WireGuard

\`\`\`bash
/interface wireguard
add name=wg0 listen-port=13231 mtu=1420

# مشاهده کلید عمومی تولیدشده
/interface wireguard print
\`\`\`

## مرحله ۲: تخصیص IP به رابط WireGuard

\`\`\`bash
/ip address add address=10.200.0.1/24 interface=wg0
\`\`\`

## مرحله ۳: تولید کلید کلاینت

\`\`\`bash
wg genkey | tee client_private.key | wg pubkey > client_public.key
\`\`\`

## مرحله ۴: افزودن Peer روی RouterOS

\`\`\`bash
/interface wireguard peers
add interface=wg0   public-key="CLIENT_PUBLIC_KEY_HERE"   allowed-address=10.200.0.2/32   comment="Laptop-John"
\`\`\`

## مرحله ۵: پیکربندی فایروال

\`\`\`bash
/ip firewall filter
add chain=input protocol=udp dst-port=13231 action=accept comment="WireGuard"
add chain=input src-address=10.200.0.0/24 action=accept
add chain=forward src-address=10.200.0.0/24 action=accept
\`\`\`

## مرحله ۶: فایل پیکربندی کلاینت

\`\`\`ini
[Interface]
PrivateKey = CLIENT_PRIVATE_KEY_HERE
Address = 10.200.0.2/24
DNS = 8.8.8.8

[Peer]
PublicKey = MIKROTIK_PUBLIC_KEY_HERE
Endpoint = YOUR_PUBLIC_IP:13231
AllowedIPs = 192.168.1.0/24, 10.200.0.0/24
PersistentKeepalive = 25
\`\`\`

## پایش WireGuard

\`\`\`bash
# بررسی وضعیت handshake peer
/interface wireguard peers print
/interface wireguard peers print stats
\`\`\`

## نکات کارایی

1. WireGuard از ChaCha20-Poly1305 استفاده می‌کند — بسیار سریع روی CPU‌های ARM
2. MTU را روی ۱۴۲۰ تنظیم کنید
3. \`PersistentKeepalive=25\` نگاشت‌های NAT را برای کلاینت‌های موبایل زنده نگه می‌دارد
4. برای کاربران roaming از \`AllowedIPs = 0.0.0.0/0\` استفاده کنید`,
  },
  'mikrotik-hotspot-captive-portal': {
    contentEn: `## Introduction

MikroTik HotSpot is a built-in captive portal system perfect for hotels, cafes, schools, and public Wi-Fi deployments. Users authenticate through a web page before getting internet access. This guide covers a complete production HotSpot setup.

## How MikroTik HotSpot Works

1. Client connects to Wi-Fi and gets an IP via DHCP
2. Client opens any website — MikroTik intercepts and redirects to login page
3. Client enters credentials
4. MikroTik creates a dynamic firewall rule allowing the client's IP
5. Client gets internet access until session timeout or manual logout

## Step 1: Set Up the Interface

\`\`\`bash
# Create a bridge for HotSpot clients
/interface bridge add name=bridge-hotspot

# Add wireless interface to bridge
/interface bridge port add bridge=bridge-hotspot interface=wlan1

# Assign IP to the bridge
/ip address add address=10.5.50.1/24 interface=bridge-hotspot
\`\`\`

## Step 2: Configure DHCP Server

\`\`\`bash
/ip pool add name=hotspot-pool ranges=10.5.50.10-10.5.50.254
/ip dhcp-server add name=hotspot interface=bridge-hotspot address-pool=hotspot-pool lease-time=1h
/ip dhcp-server network add address=10.5.50.0/24 gateway=10.5.50.1 dns-server=8.8.8.8,8.8.4.4
\`\`\`

## Step 3: Run HotSpot Setup Wizard

\`\`\`bash
/ip hotspot setup
# Follow the wizard:
# hotspot interface: bridge-hotspot
# local address: 10.5.50.1/24
# masquerade network: yes
# DNS name: hotspot.company.com
# create local hotspot user: admin / password123
\`\`\`

## Step 4: Create User Profiles

Profiles define session limits:

\`\`\`bash
/ip hotspot user profile
add name="1hour-free" session-timeout=1h idle-timeout=10m shared-users=1
add name="daily-5mbps" session-timeout=24h rate-limit="5M/2M" shared-users=1
add name="premium-20mbps" session-timeout=0 rate-limit="20M/5M" shared-users=3
\`\`\`

## Step 5: Add Users

\`\`\`bash
/ip hotspot user
add name=guest password=guest1234 profile=1hour-free
add name=john password=secure789 profile=daily-5mbps mac-address=AA:BB:CC:DD:EE:FF
\`\`\`

## Step 6: Customize the Login Page

Login pages are stored in \`/flash/hotspot/\` on the router. Upload custom HTML:

\`\`\`bash
# From your PC, SCP files to the router
scp login.html admin@192.168.88.1:/flash/hotspot/login.html
\`\`\`

Key variables available in the HTML template:
- \`$(link-login)\` — login form action URL
- \`$(link-logout)\` — logout URL
- \`$(username)\` — currently logged in user
- \`$(error)\` — error message

## Step 7: Walled Garden (Allow Pre-Auth Access)

Allow certain sites before login (e.g., company website, payment gateway):

\`\`\`bash
/ip hotspot walled-garden
add dst-host=company.com action=allow
add dst-host=*.company.com action=allow
add dst-host=payment-provider.com action=allow
\`\`\`

For IP-based rules:

\`\`\`bash
/ip hotspot walled-garden ip
add dst-address=1.2.3.4 action=accept
\`\`\`

## Step 8: RADIUS Integration

For large deployments, use a RADIUS server instead of local users:

\`\`\`bash
/radius
add service=hotspot address=192.168.1.100 secret=radiussecret

/ip hotspot
set [find] use-radius=yes
\`\`\`

## Monitoring Active Sessions

\`\`\`bash
# View active HotSpot sessions
/ip hotspot active print

# View all users
/ip hotspot user print

# See host table (all connected devices)
/ip hotspot host print
\`\`\`

## Production Tips

1. Set \`idle-timeout\` to disconnect inactive users and free licenses
2. Use MAC address binding to remember returning customers
3. Enable HTTPS on the login page using a real certificate
4. Use RADIUS for environments with 100+ users
5. Set \`traffic-quota\` on profiles to prevent abuse`,
    contentFa: `## مقدمه

MikroTik HotSpot یک سیستم captive portal داخلی است که برای هتل‌ها، کافه‌ها، مدارس و شبکه‌های Wi-Fi عمومی ایده‌آل است. این راهنما یک راه‌اندازی کامل HotSpot در محیط تولیدی را پوشش می‌دهد.

## چگونگی کارکرد MikroTik HotSpot

۱. کلاینت به Wi-Fi متصل می‌شود و IP دریافت می‌کند
۲. کلاینت هر وب‌سایتی را باز می‌کند — MikroTik به صفحه ورود هدایت می‌کند
۳. کلاینت اعتبارنامه وارد می‌کند
۴. MikroTik یک قانون فایروال پویا ایجاد می‌کند
۵. کلاینت به اینترنت دسترسی پیدا می‌کند

## مرحله ۱: راه‌اندازی رابط

\`\`\`bash
/interface bridge add name=bridge-hotspot
/interface bridge port add bridge=bridge-hotspot interface=wlan1
/ip address add address=10.5.50.1/24 interface=bridge-hotspot
\`\`\`

## مرحله ۲: پیکربندی DHCP

\`\`\`bash
/ip pool add name=hotspot-pool ranges=10.5.50.10-10.5.50.254
/ip dhcp-server add name=hotspot interface=bridge-hotspot address-pool=hotspot-pool lease-time=1h
/ip dhcp-server network add address=10.5.50.0/24 gateway=10.5.50.1 dns-server=8.8.8.8
\`\`\`

## مرحله ۳: اجرای Wizard راه‌اندازی HotSpot

\`\`\`bash
/ip hotspot setup
# رابط hotspot: bridge-hotspot
# آدرس محلی: 10.5.50.1/24
# DNS name: hotspot.company.com
\`\`\`

## مرحله ۴: ایجاد پروفایل کاربر

\`\`\`bash
/ip hotspot user profile
add name="1hour-free" session-timeout=1h idle-timeout=10m shared-users=1
add name="daily-5mbps" session-timeout=24h rate-limit="5M/2M" shared-users=1
add name="premium-20mbps" session-timeout=0 rate-limit="20M/5M" shared-users=3
\`\`\`

## مرحله ۵: افزودن کاربران

\`\`\`bash
/ip hotspot user
add name=guest password=guest1234 profile=1hour-free
add name=john password=secure789 profile=daily-5mbps
\`\`\`

## مرحله ۶: Walled Garden

اجازه دسترسی به سایت‌های خاص قبل از ورود:

\`\`\`bash
/ip hotspot walled-garden
add dst-host=company.com action=allow
add dst-host=*.company.com action=allow
\`\`\`

## پایش جلسات فعال

\`\`\`bash
/ip hotspot active print
/ip hotspot user print
/ip hotspot host print
\`\`\``,
  },
  'mikrotik-bgp-routeros7': {
    contentEn: `## Introduction

BGP (Border Gateway Protocol) on MikroTik RouterOS 7 uses an entirely rewritten routing engine compared to ROS 6. The new engine is more efficient, better handles large routing tables, and introduces significant configuration changes. This guide covers the new BGP configuration model.

## Key Differences in RouterOS 7 BGP

| Feature | RouterOS 6 | RouterOS 7 |
|---------|-----------|-----------|
| BGP instance | \`/routing bgp instance\` | \`/routing bgp template\` |
| Peer config | \`/routing bgp peer\` | \`/routing bgp connection\` |
| Network advertising | \`/routing bgp network\` | via filters |
| Route filters | basic | powerful scripting |

## Step 1: Configure BGP Template (Router Identity)

\`\`\`bash
# Set router AS number and router-id
/routing bgp template
add name=default as=65001 router-id=10.0.0.1
\`\`\`

## Step 2: Add BGP Peer Connection

For a simple eBGP connection to your ISP:

\`\`\`bash
/routing bgp connection
add name=ISP-Peer   template=default   remote.address=203.0.113.1   remote.as=65000   local.address=203.0.113.2   output.filter-chain=TO-ISP   input.filter-chain=FROM-ISP
\`\`\`

## Step 3: Route Filters

RouterOS 7 uses a new filter scripting language:

\`\`\`bash
/routing filter rule
# Advertise only your own prefix
add chain=TO-ISP rule="if (dst == 192.168.0.0/16) { accept } else { reject }"

# Accept default route from ISP, reject everything else
add chain=FROM-ISP rule="if (dst == 0.0.0.0/0) { accept } else { reject }"
\`\`\`

## Step 4: Advertise Your Networks

\`\`\`bash
# Add connected network to BGP output
/routing bgp connection
set ISP-Peer output.network=192.168.0.0/16
\`\`\`

Or use more specific filter to control what gets announced:

\`\`\`bash
/routing filter rule
add chain=TO-ISP rule="
  if (dst == 192.168.1.0/24 || dst == 192.168.2.0/24) {
    set bgp-communities 65001:100;
    accept
  }
  reject
"
\`\`\`

## iBGP Configuration

For connecting two routers within the same AS:

\`\`\`bash
/routing bgp connection
add name=IBGP-R2   template=default   remote.address=10.0.0.2   remote.as=65001   local.address=10.0.0.1
\`\`\`

Key difference: iBGP does NOT increment the \`as-path\`, so you need either:
- Full mesh between all iBGP routers, OR
- Route Reflector setup

## Route Reflector Setup

Designate one router as the Route Reflector:

\`\`\`bash
/routing bgp connection
add name=RR-Client1   template=default   remote.address=10.0.0.3   remote.as=65001   route-reflect=yes   cluster-id=10.0.0.1
\`\`\`

## BGP Communities

Set and match communities for traffic engineering:

\`\`\`bash
/routing filter rule
add chain=FROM-ISP rule="
  if (bgp-communities includes 65000:200) {
    set bgp-local-pref 200;
    accept
  }
"
\`\`\`

## Verification and Troubleshooting

\`\`\`bash
# View BGP sessions
/routing bgp connection print
/routing bgp session print

# View BGP routing table
/routing route print where bgp

# Check BGP advertisements
/routing bgp advertisement print

# Debug BGP events
/routing bgp connection monitor [find name=ISP-Peer] output=yes
\`\`\`

## Real-World Multi-Homing Setup

Two ISPs, prefer ISP1, failover to ISP2:

\`\`\`bash
/routing bgp connection
add name=ISP1 template=default remote.address=1.1.1.1 remote.as=65100   input.filter-chain=FROM-ISP1 output.filter-chain=TO-ISP
add name=ISP2 template=default remote.address=2.2.2.2 remote.as=65200   input.filter-chain=FROM-ISP2 output.filter-chain=TO-ISP

/routing filter rule
add chain=FROM-ISP1 rule="set bgp-local-pref 200; accept"
add chain=FROM-ISP2 rule="set bgp-local-pref 100; accept"
\`\`\``,
    contentFa: `## مقدمه

BGP روی MikroTik RouterOS 7 از موتور مسیریابی کاملاً بازنویسی‌شده‌ای استفاده می‌کند. این راهنما مدل پیکربندی جدید BGP را پوشش می‌دهد.

## تفاوت‌های کلیدی در RouterOS 7 BGP

| ویژگی | RouterOS 6 | RouterOS 7 |
|------|-----------|-----------|
| نمونه BGP | \`/routing bgp instance\` | \`/routing bgp template\` |
| پیکربندی Peer | \`/routing bgp peer\` | \`/routing bgp connection\` |

## مرحله ۱: پیکربندی قالب BGP

\`\`\`bash
/routing bgp template
add name=default as=65001 router-id=10.0.0.1
\`\`\`

## مرحله ۲: افزودن اتصال BGP

\`\`\`bash
/routing bgp connection
add name=ISP-Peer   template=default   remote.address=203.0.113.1   remote.as=65000   local.address=203.0.113.2   output.filter-chain=TO-ISP   input.filter-chain=FROM-ISP
\`\`\`

## مرحله ۳: فیلترهای مسیر

\`\`\`bash
/routing filter rule
add chain=TO-ISP rule="if (dst == 192.168.0.0/16) { accept } else { reject }"
add chain=FROM-ISP rule="if (dst == 0.0.0.0/0) { accept } else { reject }"
\`\`\`

## تأیید و رفع عیب

\`\`\`bash
/routing bgp connection print
/routing bgp session print
/routing route print where bgp
/routing bgp advertisement print
\`\`\`

## راه‌اندازی Multi-Homing

دو ISP، اولویت ISP1، Failover به ISP2:

\`\`\`bash
/routing filter rule
add chain=FROM-ISP1 rule="set bgp-local-pref 200; accept"
add chain=FROM-ISP2 rule="set bgp-local-pref 100; accept"
\`\`\``,
  },
  'mikrotik-dual-wan-failover': {
    contentEn: `## Introduction

Dual WAN failover on MikroTik ensures your network stays connected when one ISP goes down. MikroTik supports two main approaches: **recursive routing** (the modern way) and **mangle + routing tables** (the classic way). This guide covers both methods.

## Method 1: Recursive Routing (Recommended for ROS 7)

This method uses check-gateway to detect failures and automatically switches routes.

### Step 1: Configure WAN Interfaces

\`\`\`bash
/ip address
add address=203.0.113.2/30 interface=ether1-WAN1 comment="ISP1"
add address=198.51.100.2/30 interface=ether2-WAN2 comment="ISP2"
\`\`\`

### Step 2: Add Default Routes with Distance

\`\`\`bash
/ip route
add dst-address=0.0.0.0/0 gateway=203.0.113.1 distance=1 check-gateway=ping comment="ISP1-Primary"
add dst-address=0.0.0.0/0 gateway=198.51.100.1 distance=2 check-gateway=ping comment="ISP2-Backup"
\`\`\`

The \`distance=1\` route is preferred. If \`check-gateway=ping\` fails (3 missed pings), the route is deactivated and ROS falls back to the \`distance=2\` route.

### Step 3: NAT for Both WANs

\`\`\`bash
/ip firewall nat
add chain=srcnat out-interface=ether1-WAN1 action=masquerade comment="NAT-ISP1"
add chain=srcnat out-interface=ether2-WAN2 action=masquerade comment="NAT-ISP2"
\`\`\`

## Method 2: Mangle + Policy Routing (Load Balancing + Failover)

This method distributes traffic across both links AND provides failover.

### Step 1: Mark incoming connections to remember which WAN they came from

\`\`\`bash
/ip firewall mangle
# Mark new connections coming in from WAN1
add chain=input in-interface=ether1-WAN1 action=mark-connection new-connection-mark=ISP1 passthrough=yes
# Mark new connections coming in from WAN2
add chain=input in-interface=ether2-WAN2 action=mark-connection new-connection-mark=ISP2 passthrough=yes
\`\`\`

### Step 2: Route responses back through the correct WAN

\`\`\`bash
/ip firewall mangle
add chain=output connection-mark=ISP1 action=mark-routing new-routing-mark=use-ISP1 passthrough=no
add chain=output connection-mark=ISP2 action=mark-routing new-routing-mark=use-ISP2 passthrough=no
\`\`\`

### Step 3: Load balance new connections using PCC (Per Connection Classifier)

\`\`\`bash
/ip firewall mangle
add chain=prerouting in-interface=bridge-LAN   per-connection-classifier=both-addresses:2/0   action=mark-routing new-routing-mark=use-ISP1 passthrough=no
add chain=prerouting in-interface=bridge-LAN   per-connection-classifier=both-addresses:2/1   action=mark-routing new-routing-mark=use-ISP2 passthrough=no
\`\`\`

### Step 4: Create routing tables

\`\`\`bash
/routing table
add name=use-ISP1 fib
add name=use-ISP2 fib
\`\`\`

### Step 5: Add routes for each table

\`\`\`bash
/ip route
add dst-address=0.0.0.0/0 gateway=203.0.113.1 routing-table=use-ISP1 check-gateway=ping
add dst-address=0.0.0.0/0 gateway=198.51.100.1 routing-table=use-ISP2 check-gateway=ping
# Main route
add dst-address=0.0.0.0/0 gateway=203.0.113.1 distance=1 check-gateway=ping
add dst-address=0.0.0.0/0 gateway=198.51.100.1 distance=2 check-gateway=ping
\`\`\`

## Monitoring Failover

\`\`\`bash
# Check which routes are active
/ip route print where active

# Monitor WAN uptime
/interface print stats where name~"WAN"

# Ping test through specific WAN
/ping 8.8.8.8 routing-table=use-ISP1 count=4
/ping 8.8.8.8 routing-table=use-ISP2 count=4
\`\`\`

## Failover Testing

\`\`\`bash
# Simulate WAN1 failure by disabling interface
/interface disable ether1-WAN1

# Check that traffic switches to ISP2
/ip route print where active

# Re-enable
/interface enable ether1-WAN1
\`\`\`

## Common Issues

**Issue**: Both WANs stay up but check-gateway fails
- Check that the gateway IP actually responds to ICMP
- Some ISPs block ICMP — use \`check-gateway=arp\` instead

**Issue**: Traffic not load balancing
- Verify PCC rules are in prerouting with correct in-interface
- Check that routing marks match routing table names exactly`,
    contentFa: `## مقدمه

Dual WAN Failover در MikroTik تضمین می‌کند که شبکه شما هنگام قطع یک ISP متصل بماند. دو روش اصلی وجود دارد: **recursive routing** (روش مدرن) و **mangle + routing tables** (روش کلاسیک).

## روش ۱: Recursive Routing (توصیه‌شده برای ROS 7)

\`\`\`bash
# پیکربندی آدرس‌های WAN
/ip address
add address=203.0.113.2/30 interface=ether1-WAN1 comment="ISP1"
add address=198.51.100.2/30 interface=ether2-WAN2 comment="ISP2"

# مسیرهای پیش‌فرض با distance
/ip route
add dst-address=0.0.0.0/0 gateway=203.0.113.1 distance=1 check-gateway=ping comment="ISP1-Primary"
add dst-address=0.0.0.0/0 gateway=198.51.100.1 distance=2 check-gateway=ping comment="ISP2-Backup"

# NAT برای هر دو WAN
/ip firewall nat
add chain=srcnat out-interface=ether1-WAN1 action=masquerade
add chain=srcnat out-interface=ether2-WAN2 action=masquerade
\`\`\`

## روش ۲: Mangle + Policy Routing (Load Balancing + Failover)

\`\`\`bash
# علامت‌گذاری اتصالات ورودی
/ip firewall mangle
add chain=input in-interface=ether1-WAN1 action=mark-connection new-connection-mark=ISP1 passthrough=yes
add chain=input in-interface=ether2-WAN2 action=mark-connection new-connection-mark=ISP2 passthrough=yes

# Load balancing با PCC
add chain=prerouting in-interface=bridge-LAN   per-connection-classifier=both-addresses:2/0   action=mark-routing new-routing-mark=use-ISP1 passthrough=no
add chain=prerouting in-interface=bridge-LAN   per-connection-classifier=both-addresses:2/1   action=mark-routing new-routing-mark=use-ISP2 passthrough=no
\`\`\`

## پایش Failover

\`\`\`bash
/ip route print where active
/ping 8.8.8.8 routing-table=use-ISP1 count=4
/ping 8.8.8.8 routing-table=use-ISP2 count=4
\`\`\``,
  },
  'mikrotik-crs-switch-management': {
    contentEn: `## Introduction

MikroTik CRS (Cloud Router Switch) series devices combine a powerful switch chip with a full RouterOS instance. They can function as pure Layer 2 switches, routers, or a hybrid of both. Understanding when to use the switch chip vs CPU is critical for performance.

## CRS Architecture

- **Switch chip**: Hardware forwarding at wire speed — handles VLANs, port isolation, trunks
- **CPU (RouterOS)**: Software processing — handles routing, firewall, queues

**Rule**: Always use the switch chip for L2 operations. Never route through CPU on a CRS.

## VLAN Configuration on CRS (Bridge VLAN Filtering)

RouterOS 7 uses Bridge VLAN Filtering — the modern recommended approach.

### Step 1: Create a bridge

\`\`\`bash
/interface bridge
add name=br1 vlan-filtering=yes pvid=1 frame-types=admit-all
\`\`\`

### Step 2: Add ports to bridge

\`\`\`bash
/interface bridge port
add bridge=br1 interface=ether1 pvid=10 frame-types=admit-only-untagged-and-priority-tagged
add bridge=br1 interface=ether2 pvid=20 frame-types=admit-only-untagged-and-priority-tagged
add bridge=br1 interface=ether3 frame-types=admit-only-vlan-tagged  # Trunk port
\`\`\`

### Step 3: Configure VLANs on bridge

\`\`\`bash
/interface bridge vlan
add bridge=br1 vlan-ids=10 tagged=ether3 untagged=ether1
add bridge=br1 vlan-ids=20 tagged=ether3 untagged=ether2
add bridge=br1 vlan-ids=10,20 tagged=br1  # Management VLAN on CPU
\`\`\`

### Step 4: Assign IPs for management

\`\`\`bash
/interface vlan
add name=vlan10-mgmt interface=br1 vlan-id=10
/ip address add address=192.168.10.1/24 interface=vlan10-mgmt
\`\`\`

## Inter-VLAN Routing on CRS

For CRS to route between VLANs (using CPU — only for low-traffic management):

\`\`\`bash
/interface vlan
add name=vlan10 interface=br1 vlan-id=10
add name=vlan20 interface=br1 vlan-id=20

/ip address
add address=192.168.10.1/24 interface=vlan10
add address=192.168.20.1/24 interface=vlan20
\`\`\`

**Warning**: Inter-VLAN routing goes through CPU, not the switch chip. For high-traffic inter-VLAN routing, use a dedicated router.

## Port Isolation (Private VLAN)

Prevent ports from talking to each other (useful for hotels, apartments):

\`\`\`bash
/interface bridge port
set [find interface=ether1] horizon=1
set [find interface=ether2] horizon=1
set [find interface=ether3] horizon=1
# Ports with same horizon cannot communicate with each other
# Only the uplink (no horizon) can reach all ports
\`\`\`

## STP/RSTP Configuration

Prevent loops in redundant topologies:

\`\`\`bash
/interface bridge
set br1 protocol-mode=rstp priority=0x1000

# Set port cost for STP path calculation
/interface bridge port
set [find interface=ether1] path-cost=4  # Faster link = lower cost
\`\`\`

## Checking Switch Chip Usage

\`\`\`bash
# Verify hardware offload is working
/interface bridge port print detail
# Look for "hw=yes" — this means the switch chip handles forwarding

# If hw=no, check why CPU is doing the forwarding
/interface bridge print detail
\`\`\`

## Common CRS Models

| Model | Switch Chip | Ports | Routing |
|-------|-------------|-------|---------|
| CRS305-1G-4S+ | 88E6393X | 4x SFP+ | Yes |
| CRS317-1G-16S+ | 98DX8216 | 16x SFP+ | Limited |
| CRS354-48G-4S+2Q+ | 98DX3257 | 48x GbE | Yes |

## Best Practices

1. Enable \`vlan-filtering=yes\` on the bridge — this enables hw offload
2. Don't add unnecessary services to CRS — keep it as a switch
3. Use RSTP, not STP, for faster convergence (1-2 sec vs 30-50 sec)
4. Always keep a management VLAN separate from data VLANs
5. Monitor CPU usage — if it's high, something is being processed in software`,
    contentFa: `## مقدمه

سری MikroTik CRS (Cloud Router Switch) یک چیپ سوئیچ قوی را با یک نمونه کامل RouterOS ترکیب می‌کند. درک تفاوت بین استفاده از چیپ سوئیچ و CPU برای کارایی بسیار مهم است.

## معماری CRS

- **چیپ سوئیچ**: فوروارد سخت‌افزاری با سرعت خط — VLAN، ایزولاسیون پورت
- **CPU (RouterOS)**: پردازش نرم‌افزاری — مسیریابی، فایروال، صف‌ها

## پیکربندی VLAN روی CRS

\`\`\`bash
# ایجاد bridge
/interface bridge
add name=br1 vlan-filtering=yes pvid=1

# افزودن پورت‌ها
/interface bridge port
add bridge=br1 interface=ether1 pvid=10 frame-types=admit-only-untagged-and-priority-tagged
add bridge=br1 interface=ether2 pvid=20 frame-types=admit-only-untagged-and-priority-tagged
add bridge=br1 interface=ether3 frame-types=admit-only-vlan-tagged

# پیکربندی VLAN‌ها
/interface bridge vlan
add bridge=br1 vlan-ids=10 tagged=ether3 untagged=ether1
add bridge=br1 vlan-ids=20 tagged=ether3 untagged=ether2
\`\`\`

## ایزولاسیون پورت

جلوگیری از ارتباط بین پورت‌ها (مناسب هتل‌ها):

\`\`\`bash
/interface bridge port
set [find interface=ether1] horizon=1
set [find interface=ether2] horizon=1
\`\`\`

## بررسی استفاده از چیپ سوئیچ

\`\`\`bash
/interface bridge port print detail
# به دنبال "hw=yes" بگردید
\`\`\`

## بهترین روش‌ها

۱. همیشه \`vlan-filtering=yes\` را روی bridge فعال کنید
۲. CRS را تا حد امکان به عنوان سوئیچ نگه دارید
۳. از RSTP استفاده کنید، نه STP
۴. یک VLAN مدیریتی جداگانه داشته باشید`,
  },
  'mikrotik-advanced-mangle': {
    contentEn: `## Introduction

Mangle is MikroTik's packet marking engine — it's used to mark packets and connections so they can be treated differently by queues, routing tables, and NAT. Mastering mangle is essential for advanced QoS, policy routing, and traffic engineering.

## Mangle Chains

| Chain | When it runs | Use case |
|-------|-------------|----------|
| prerouting | Before routing decision | Mark packets from LAN before routing |
| input | Packets destined for router | Rate-limit management access |
| forward | Packets through the router | Mark inter-network traffic |
| output | Packets generated by router | Mark router's own traffic |
| postrouting | After routing decision | Rarely used |

## Connection vs Packet Marks

- **Connection mark**: Applied to the entire TCP/UDP connection (all packets in both directions)
- **Packet mark**: Applied to individual packets, usually derived from connection mark

**Always mark the connection first, then derive packet marks from it.**

## Example 1: VoIP Traffic Prioritization

Mark all SIP and RTP traffic for high-priority queue:

\`\`\`bash
/ip firewall mangle

# Mark SIP signaling (port 5060)
add chain=prerouting protocol=udp dst-port=5060   action=mark-connection new-connection-mark=voip-conn passthrough=yes

# Mark RTP media (UDP port range 10000-20000)
add chain=prerouting protocol=udp dst-port=10000-20000   action=mark-connection new-connection-mark=voip-conn passthrough=yes

# Mark all packets in VoIP connections
add chain=prerouting connection-mark=voip-conn   action=mark-packet new-packet-mark=voip-pkt passthrough=no
\`\`\`

Then reference \`voip-pkt\` in your queue tree with priority=1.

## Example 2: Policy Routing by Source IP

Route specific department to a different WAN:

\`\`\`bash
/routing table add name=ISP2-Table fib

/ip firewall mangle
# Marketing department (192.168.20.0/24) → ISP2
add chain=prerouting src-address=192.168.20.0/24 in-interface=bridge-LAN   action=mark-routing new-routing-mark=ISP2-Table passthrough=no

# Finance department (192.168.30.0/24) → ISP1 (default)
# No mark needed, uses main routing table
\`\`\`

## Example 3: P2P Detection and Throttling

Detect BitTorrent and limit it:

\`\`\`bash
/ip firewall mangle

# Use layer7 protocol matcher for P2P detection
/ip firewall layer7-protocol
add name=bittorrent regexp="^(\x13bittorrent protocol|azver\x01\$|get /scrape\\?info_hash)"

# Mark P2P connections
add chain=prerouting layer7-protocol=bittorrent   action=mark-connection new-connection-mark=p2p passthrough=yes
add chain=prerouting connection-mark=p2p   action=mark-packet new-packet-mark=p2p-pkt passthrough=no

# Apply slow queue to P2P in /queue tree
\`\`\`

## Example 4: Bypass VPN for Specific Traffic

Send gaming traffic directly without going through VPN:

\`\`\`bash
/ip firewall mangle
# Steam gaming servers direct route
add chain=prerouting dst-address-list=steam-servers   action=mark-routing new-routing-mark=direct-internet passthrough=no

/ip address-list add list=steam-servers address=103.10.124.0/23
/ip address-list add list=steam-servers address=185.25.180.0/22
\`\`\`

## Mangle Debugging

\`\`\`bash
# Count packets matching a rule (add count action before main action)
/ip firewall mangle
add chain=prerouting src-address=192.168.1.100 action=passthrough

# Use torch to see real-time traffic
/tool torch interface=bridge-LAN

# Check mangle rule statistics
/ip firewall mangle print stats
\`\`\`

## Advanced: Connection State Matching

Only mark NEW connections (not established/related):

\`\`\`bash
/ip firewall mangle
add chain=prerouting connection-state=new src-address=192.168.1.0/24   per-connection-classifier=both-addresses:2/0   action=mark-connection new-connection-mark=use-ISP1 passthrough=yes
add chain=prerouting connection-state=new src-address=192.168.1.0/24   per-connection-classifier=both-addresses:2/1   action=mark-connection new-connection-mark=use-ISP2 passthrough=yes
\`\`\`

## Performance Notes

1. Mangle runs on CPU — complex rules slow down throughput
2. Order matters: rules are evaluated top-to-bottom, stop at first match (with \`passthrough=no\`)
3. Use \`passthrough=yes\` when you want multiple rules to apply
4. Connection marks persist for the entire connection lifetime
5. \`print stats\` shows hit count — zero-hit rules should be reviewed or removed`,
    contentFa: `## مقدمه

Mangle موتور علامت‌گذاری بسته‌های MikroTik است که برای علامت‌گذاری بسته‌ها و اتصالات استفاده می‌شود تا توسط صف‌ها، جداول مسیریابی و NAT متفاوت رفتار شود.

## زنجیره‌های Mangle

| زنجیر | زمان اجرا | کاربرد |
|------|----------|--------|
| prerouting | قبل از تصمیم مسیریابی | علامت‌گذاری بسته‌های LAN |
| forward | بسته‌های عبوری از روتر | ترافیک بین شبکه‌ها |
| output | بسته‌های تولیدشده توسط روتر | ترافیک خود روتر |

## مثال ۱: اولویت‌بندی ترافیک VoIP

\`\`\`bash
/ip firewall mangle
add chain=prerouting protocol=udp dst-port=5060   action=mark-connection new-connection-mark=voip-conn passthrough=yes
add chain=prerouting protocol=udp dst-port=10000-20000   action=mark-connection new-connection-mark=voip-conn passthrough=yes
add chain=prerouting connection-mark=voip-conn   action=mark-packet new-packet-mark=voip-pkt passthrough=no
\`\`\`

## مثال ۲: Policy Routing بر اساس IP منبع

\`\`\`bash
/routing table add name=ISP2-Table fib

/ip firewall mangle
add chain=prerouting src-address=192.168.20.0/24 in-interface=bridge-LAN   action=mark-routing new-routing-mark=ISP2-Table passthrough=no
\`\`\`

## مثال ۳: شناسایی و محدودسازی P2P

\`\`\`bash
/ip firewall layer7-protocol
add name=bittorrent regexp="^(\x13bittorrent protocol)"

/ip firewall mangle
add chain=prerouting layer7-protocol=bittorrent   action=mark-connection new-connection-mark=p2p passthrough=yes
add chain=prerouting connection-mark=p2p   action=mark-packet new-packet-mark=p2p-pkt passthrough=no
\`\`\`

## اشکال‌زدایی Mangle

\`\`\`bash
/ip firewall mangle print stats
/tool torch interface=bridge-LAN
\`\`\``,
  },
  'ssl-tls-certificate-management': {
    contentEn: `## Introduction

SSL/TLS certificates are the foundation of secure communication on the internet. Every time you see HTTPS in your browser, a certificate is working behind the scenes to encrypt traffic and verify identity. As an infrastructure engineer, you'll manage certificates for web servers, internal services, APIs, and more.

## How TLS Works (Quick Overview)

When a client connects to a server:
1. Client sends "Hello" with supported TLS versions and cipher suites
2. Server responds with its certificate and chosen cipher
3. Client verifies the certificate against trusted Certificate Authorities (CAs)
4. Both sides derive encryption keys using asymmetric cryptography
5. All subsequent data is encrypted symmetrically

## Certificate Types

| Type | Use Case | Cost |
|------|----------|------|
| DV (Domain Validation) | Basic HTTPS | Free (Let's Encrypt) |
| OV (Organization Validation) | Business sites | Paid |
| EV (Extended Validation) | High-trust sites | Expensive |
| Wildcard *.domain.com | Multiple subdomains | Varies |
| SAN (Multi-domain) | Multiple domains | Varies |

## Installing OpenSSL

\`\`\`bash
# Ubuntu/Debian
apt install openssl

# Verify version
openssl version
# OpenSSL 3.0.2 15 Mar 2022
\`\`\`

## Generating a Self-Signed Certificate

For internal/test use:

\`\`\`bash
# Generate private key + self-signed cert in one command
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt   -days 365 -nodes   -subj "/C=IR/ST=Tehran/L=Tehran/O=Company/CN=server.company.local"

# Verify the certificate
openssl x509 -in server.crt -text -noout
\`\`\`

## Getting a Free Certificate with Let's Encrypt

Certbot automates Let's Encrypt certificate issuance and renewal:

\`\`\`bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate for nginx (automatic configuration)
certbot --nginx -d example.com -d www.example.com

# Get certificate only (manual nginx config)
certbot certonly --nginx -d example.com

# Certificates are stored in:
# /etc/letsencrypt/live/example.com/fullchain.pem  (cert + chain)
# /etc/letsencrypt/live/example.com/privkey.pem    (private key)
\`\`\`

### Auto-Renewal

Let's Encrypt certs expire in 90 days. Certbot sets up automatic renewal:

\`\`\`bash
# Test renewal (dry run, doesn't actually renew)
certbot renew --dry-run

# Check renewal timer
systemctl status certbot.timer

# Manual renewal
certbot renew
\`\`\`

## Generating CSR for Paid Certificates

When buying from a commercial CA, you submit a Certificate Signing Request:

\`\`\`bash
# Step 1: Generate private key
openssl genrsa -out company.key 4096

# Step 2: Generate CSR
openssl req -new -key company.key -out company.csr   -subj "/C=IR/ST=Tehran/O=Company Ltd/CN=www.company.com"

# Step 3: Verify CSR content
openssl req -in company.csr -text -noout

# Step 4: Submit company.csr to your CA (DigiCert, Sectigo, etc.)
# Step 5: CA sends back company.crt — install it
\`\`\`

## Nginx SSL Configuration

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Modern TLS settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS - tell browsers to always use HTTPS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # OCSP Stapling - speeds up TLS handshake
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 1.1.1.1 valid=300s;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
\`\`\`

## Building an Internal CA (PKI)

For internal services (not public internet), build your own CA:

\`\`\`bash
# Create CA directory structure
mkdir -p /etc/ssl/myca/{certs,private,newcerts}
echo "01" > /etc/ssl/myca/serial
touch /etc/ssl/myca/index.txt

# Generate CA private key (keep this VERY secure)
openssl genrsa -aes256 -out /etc/ssl/myca/private/ca.key 4096

# Generate CA certificate (valid 10 years)
openssl req -new -x509 -days 3650   -key /etc/ssl/myca/private/ca.key   -out /etc/ssl/myca/certs/ca.crt   -subj "/C=IR/O=Company Internal CA/CN=Company Root CA"

# Sign a server certificate with your CA
openssl ca -config /etc/ssl/openssl.cnf   -in server.csr -out server.crt   -days 365
\`\`\`

## Useful OpenSSL Commands

\`\`\`bash
# Check certificate expiry
openssl x509 -in cert.pem -noout -dates

# Check remote server certificate
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -text

# Check certificate matches private key (MD5 should match)
openssl x509 -noout -modulus -in cert.pem | md5sum
openssl rsa -noout -modulus -in key.pem | md5sum

# Convert PFX to PEM (common for Windows certificates)
openssl pkcs12 -in cert.pfx -out cert.pem -nodes

# Convert PEM to PFX
openssl pkcs12 -export -out cert.pfx -inkey key.pem -in cert.pem -certfile ca.pem
\`\`\`

## Certificate Monitoring

Set up monitoring to alert before certificates expire:

\`\`\`bash
#!/bin/bash
# check-cert-expiry.sh
DOMAIN="example.com"
DAYS_WARN=30

EXPIRY=$(echo | openssl s_client -connect $DOMAIN:443 2>/dev/null   | openssl x509 -noout -enddate | cut -d= -f2)

EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt $DAYS_WARN ]; then
  echo "WARNING: $DOMAIN cert expires in $DAYS_LEFT days!"
fi
\`\`\`

## Summary

- Use Let's Encrypt for public-facing services — it's free and auto-renews
- Build an internal CA for internal services and device authentication
- Always use TLS 1.2 or 1.3 — disable older versions
- Monitor certificate expiry proactively — expired certs cause outages
- Never put private keys in version control
`,
    contentFa: `## مقدمه

گواهینامههای SSL/TLS پایه ارتباط امن در اینترنت هستند. هر بار که HTTPS را در مرورگر میبینید، یک گواهینامه در پشت صحنه کار میکند تا ترافیک را رمزگذاری کند و هویت را تأیید نماید.

## نحوه کار TLS

وقتی کلاینت به سرور متصل میشود:
1. کلاینت "Hello" با نسخههای TLS پشتیبانیشده ارسال میکند
2. سرور با گواهینامه خود پاسخ میدهد
3. کلاینت گواهینامه را در برابر CAهای معتمد تأیید میکند
4. هر دو طرف کلیدهای رمزنگاری را مشتق میکنند
5. تمام دادههای بعدی رمزگذاری میشوند

## انواع گواهینامه

| نوع | کاربرد | هزینه |
|-----|---------|-------|
| DV | HTTPS پایه | رایگان (Let's Encrypt) |
| OV | سایتهای تجاری | پولی |
| Wildcard *.domain.com | زیردامنههای متعدد | متغیر |

## نصب گواهینامه رایگان با Let's Encrypt

\`\`\`bash
# نصب certbot
apt install certbot python3-certbot-nginx

# دریافت گواهینامه برای nginx
certbot --nginx -d example.com -d www.example.com

# تست تمدید خودکار
certbot renew --dry-run
\`\`\`

## پیکربندی Nginx با SSL

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

    add_header Strict-Transport-Security "max-age=63072000" always;
}

server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
\`\`\`

## ایجاد CA داخلی

برای سرویسهای داخلی، CA خودتان را بسازید:

\`\`\`bash
# تولید کلید خصوصی CA
openssl genrsa -aes256 -out /etc/ssl/myca/private/ca.key 4096

# تولید گواهینامه CA (۱۰ سال اعتبار)
openssl req -new -x509 -days 3650   -key /etc/ssl/myca/private/ca.key   -out /etc/ssl/myca/certs/ca.crt   -subj "/C=IR/O=Company/CN=Company Root CA"
\`\`\`

## دستورات مفید OpenSSL

\`\`\`bash
# بررسی تاریخ انقضاء
openssl x509 -in cert.pem -noout -dates

# بررسی گواهینامه سرور از راه دور
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -text

# تبدیل PFX به PEM
openssl pkcs12 -in cert.pfx -out cert.pem -nodes
\`\`\`

## خلاصه

- از Let's Encrypt برای سرویسهای عمومی استفاده کنید — رایگان و تمدید خودکار
- برای سرویسهای داخلی CA خودتان بسازید
- همیشه TLS 1.2 یا 1.3 استفاده کنید
- انقضای گواهینامه را با ابزار مانیتورینگ زیر نظر بگیرید
- کلیدهای خصوصی را هرگز در version control قرار ندهید
`,
  },
  'ids-ips-snort-suricata': {
    contentEn: `## Introduction

IDS (Intrusion Detection System) and IPS (Intrusion Prevention System) monitor network traffic for malicious patterns. IDS detects and alerts; IPS can also block. Snort and Suricata are the two most popular open-source options. This guide focuses on Suricata, which is modern, multi-threaded, and actively maintained.

## IDS vs IPS Modes

- **IDS mode**: Monitors traffic passively (SPAN port or TAP), alerts only — no blocking
- **IPS mode**: Inline with traffic (between firewall and switch), can drop malicious packets

## Installing Suricata

\`\`\`bash
# Ubuntu 22.04
apt install software-properties-common
add-apt-repository ppa:oisf/suricata-stable
apt update
apt install suricata

# Verify installation
suricata --version
\`\`\`

## Basic Configuration

Edit \`/etc/suricata/suricata.yaml\`:

\`\`\`yaml
# Network interface to monitor
af-packet:
  - interface: eth0
    threads: auto
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes

# Home network definition (your internal networks)
vars:
  address-groups:
    HOME_NET: "[192.168.0.0/16,10.0.0.0/8,172.16.0.0/12]"
    EXTERNAL_NET: "!$HOME_NET"

# Outputs
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: /var/log/suricata/eve.json
      types:
        - alert
        - dns
        - http
        - tls
        - flow
\`\`\`

## Downloading Rules

\`\`\`bash
# Install suricata-update (rule manager)
pip install suricata-update

# Update rules from Emerging Threats (free)
suricata-update

# List available rule sources
suricata-update list-sources

# Enable additional sources
suricata-update enable-source et/open
suricata-update enable-source ptresearch/attackdetection

# Update all enabled sources
suricata-update
\`\`\`

## Running Suricata

\`\`\`bash
# Test configuration
suricata -T -c /etc/suricata/suricata.yaml

# Start as service
systemctl start suricata
systemctl enable suricata

# IDS mode — monitor eth0
suricata -c /etc/suricata/suricata.yaml -i eth0

# Check if running
systemctl status suricata
tail -f /var/log/suricata/suricata.log
\`\`\`

## Reading Alerts

Alerts are in JSON format in \`/var/log/suricata/eve.json\`:

\`\`\`bash
# Watch for alerts in real-time
tail -f /var/log/suricata/eve.json | jq 'select(.event_type=="alert")'

# Count alerts by signature
cat /var/log/suricata/eve.json | jq 'select(.event_type=="alert") | .alert.signature' | sort | uniq -c | sort -rn | head 20

# Show specific alert details
cat /var/log/suricata/eve.json | jq 'select(.event_type=="alert") | {src_ip, dest_ip, proto, alert}'
\`\`\`

## Writing Custom Rules

Suricata rules have a specific syntax:

\`\`\`
action proto src_ip src_port direction dest_ip dest_port (options)
\`\`\`

Example rules:

\`\`\`
# Detect ICMP flood (ping flood)
alert icmp any any -> $HOME_NET any (msg:"Possible ICMP Flood"; threshold: type both, track by_src, count 100, seconds 10; sid:9000001; rev:1;)

# Detect SSH brute force attempt
alert tcp any any -> $HOME_NET 22 (msg:"SSH Brute Force Attempt"; flow:to_server; content:"SSH"; threshold: type threshold, track by_src, count 5, seconds 60; sid:9000002; rev:1;)

# Detect DNS query for known malware domain
alert dns any any -> any any (msg:"Malware DNS Query"; dns.query; content:"malware.example.com"; sid:9000003; rev:1;)
\`\`\`

Store custom rules in \`/etc/suricata/rules/local.rules\`.

## IPS Mode Setup (Inline)

For IPS mode, Suricata sits between interfaces:

\`\`\`bash
# Enable nfqueue mode in suricata.yaml
# Then use iptables to route traffic through Suricata

iptables -I FORWARD -j NFQUEUE
iptables -I INPUT -j NFQUEUE
iptables -I OUTPUT -j NFQUEUE

# Run Suricata in IPS mode
suricata -c /etc/suricata/suricata.yaml -q 0
\`\`\`

## Integration with ELK Stack

\`\`\`bash
# Ship Suricata eve.json to Elasticsearch via Filebeat
# /etc/filebeat/filebeat.yml
filebeat.inputs:
- type: log
  paths:
    - /var/log/suricata/eve.json
  json.keys_under_root: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "suricata-%{+yyyy.MM.dd}"
\`\`\`

## Summary

- Suricata is modern, multi-threaded IDS/IPS — prefer it over Snort for new deployments
- Start in IDS mode on a SPAN port before going inline IPS
- Update rules regularly with \`suricata-update\`
- Monitor eve.json logs — integrate with ELK or Graylog for dashboards
- Write custom rules for your specific environment threats
`,
    contentFa: `## مقدمه

IDS (سیستم تشخیص نفوذ) و IPS (سیستم جلوگیری از نفوذ) ترافیک شبکه را برای الگوهای مخرب مانیتور میکنند. Suricata یک ابزار متنباز مدرن و multi-threaded است که جایگزین مناسبی برای Snort در محیطهای جدید است.

## نصب Suricata

\`\`\`bash
# اوبونتو 22.04
add-apt-repository ppa:oisf/suricata-stable
apt update && apt install suricata
\`\`\`

## پیکربندی پایه

فایل \`/etc/suricata/suricata.yaml\`:

\`\`\`yaml
af-packet:
  - interface: eth0
    threads: auto

vars:
  address-groups:
    HOME_NET: "[192.168.0.0/16,10.0.0.0/8]"
    EXTERNAL_NET: "!$HOME_NET"

outputs:
  - eve-log:
      enabled: yes
      filename: /var/log/suricata/eve.json
\`\`\`

## بروزرسانی قوانین

\`\`\`bash
# نصب مدیر قوانین
pip install suricata-update

# بروزرسانی از Emerging Threats (رایگان)
suricata-update

# فعال کردن منابع بیشتر
suricata-update enable-source et/open
\`\`\`

## خواندن هشدارها

\`\`\`bash
# نمایش هشدارها در زمان واقعی
tail -f /var/log/suricata/eve.json | jq 'select(.event_type=="alert")'

# شمارش هشدارها بر اساس امضاء
cat /var/log/suricata/eve.json | jq 'select(.event_type=="alert") | .alert.signature' | sort | uniq -c | sort -rn
\`\`\`

## نوشتن قوانین سفارشی

\`\`\`
# تشخیص ICMP flood
alert icmp any any -> $HOME_NET any (msg:"ICMP Flood"; threshold: type both, track by_src, count 100, seconds 10; sid:9000001; rev:1;)

# تشخیص brute force SSH
alert tcp any any -> $HOME_NET 22 (msg:"SSH Brute Force"; flow:to_server; threshold: type threshold, track by_src, count 5, seconds 60; sid:9000002; rev:1;)
\`\`\`

## خلاصه

- Suricata را ترجیح دهید — مدرن و multi-threaded است
- با IDS mode در SPAN port شروع کنید، سپس به IPS inline بروید
- قوانین را با \`suricata-update\` بروز نگه دارید
- لاگهای eve.json را با ELK یا Graylog یکپارچه کنید
`,
  },
  'dmz-architecture-design': {
    contentEn: `## Introduction

A DMZ (Demilitarized Zone) is a network segment that sits between your internal trusted network and the untrusted internet. It hosts services that must be accessible from the internet (web servers, email, VPN endpoints) while protecting your internal network from direct internet access.

## Why DMZ?

Without DMZ: Internet → Firewall → Internal Network (all services mixed)
With DMZ: Internet → Firewall → DMZ (public services) + Firewall → Internal Network

If an attacker compromises a web server in the DMZ, they still face another firewall barrier before reaching your internal network.

## DMZ Design Patterns

### Single Firewall (Three-Leg)
\`\`\`
Internet
    |
[Firewall] ---- DMZ (eth1: 192.168.1.0/24)
    |
Internal (eth2: 10.0.0.0/8)
\`\`\`
Simple, cost-effective. One firewall with 3 interfaces. Risk: firewall is single point of failure.

### Dual Firewall (Recommended for production)
\`\`\`
Internet
    |
[Firewall 1 - Edge]
    |
   DMZ (192.168.1.0/24)
    |
[Firewall 2 - Internal]
    |
Internal Network (10.0.0.0/8)
\`\`\`
Best security. Different vendors recommended (different exploits). Higher cost.

## Firewall Rules for DMZ (pf/iptables concept)

\`\`\`bash
# iptables rules for single-firewall DMZ

# From Internet to DMZ: allow only specific services
iptables -A FORWARD -i eth0 -o eth1 -p tcp --dport 80 -j ACCEPT   # HTTP to web server
iptables -A FORWARD -i eth0 -o eth1 -p tcp --dport 443 -j ACCEPT  # HTTPS to web server
iptables -A FORWARD -i eth0 -o eth1 -p tcp --dport 25 -j ACCEPT   # SMTP to mail server

# From DMZ to Internet: allow established connections + DNS
iptables -A FORWARD -i eth1 -o eth0 -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD -i eth1 -o eth0 -p udp --dport 53 -j ACCEPT

# From DMZ to Internal: DENY by default
iptables -A FORWARD -i eth1 -o eth2 -j DROP

# From Internal to DMZ: allow management
iptables -A FORWARD -i eth2 -o eth1 -p tcp --dport 22 -j ACCEPT   # SSH to manage servers

# From Internal to Internet: allow all
iptables -A FORWARD -i eth2 -o eth0 -j ACCEPT
iptables -A FORWARD -i eth0 -o eth2 -m state --state ESTABLISHED,RELATED -j ACCEPT

# Default deny
iptables -P FORWARD DROP
\`\`\`

## Services Typically in DMZ

| Service | Port | Notes |
|---------|------|-------|
| Web server (nginx/Apache) | 80, 443 | Reverse proxy to internal app servers |
| Mail server | 25, 587, 993 | SMTP, submission, IMAPS |
| VPN gateway | 1194, 443 | OpenVPN, WireGuard |
| DNS resolver (public) | 53 | Only if hosting public DNS |
| Jump host/Bastion | 22 | For admin access to DMZ |

## Reverse Proxy in DMZ

A reverse proxy (nginx) in the DMZ proxies requests to internal app servers. The internal servers never touch the internet:

\`\`\`nginx
# DMZ nginx reverse proxy
server {
    listen 443 ssl;
    server_name app.company.com;

    ssl_certificate /etc/ssl/app.crt;
    ssl_certificate_key /etc/ssl/app.key;

    location / {
        # Forward to internal app server (10.0.1.10)
        proxy_pass http://10.0.1.10:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
\`\`\`

## Microsegmentation in DMZ

Don't put all DMZ servers on one flat subnet. Segment by function:

\`\`\`
DMZ Web Tier:   192.168.1.0/27  (web servers, load balancers)
DMZ App Tier:   192.168.1.32/27 (application servers)
DMZ DB Tier:    192.168.1.64/27 (databases — if they must be in DMZ)
DMZ Mgmt:       192.168.1.96/27 (jump hosts, monitoring)
\`\`\`

Rules between tiers: Web → App allowed; App → DB allowed; DMZ → Internal restricted.

## Monitoring DMZ

\`\`\`bash
# Install fail2ban on DMZ servers to block brute force
apt install fail2ban

# /etc/fail2ban/jail.local
[sshd]
enabled = true
maxretry = 3
bantime = 3600
findtime = 600

# Monitor connection attempts
netstat -an | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn
\`\`\`

## Summary

- DMZ isolates internet-facing services from your internal network
- Use dual firewall design for production environments
- Default-deny between DMZ and internal — only allow what's explicitly needed
- Use a reverse proxy to prevent direct internet access to internal servers
- Segment the DMZ itself — web, app, database tiers
`,
    contentFa: `## مقدمه

DMZ (منطقه غیرنظامی) یک سگمنت شبکه است که بین شبکه داخلی معتمد و اینترنت غیرمعتمد قرار میگیرد. سرویسهایی که باید از اینترنت قابل دسترس باشند (وب سرور، ایمیل، VPN) را در اینجا قرار میدهیم.

## چرا DMZ؟

بدون DMZ: اینترنت → فایروال → شبکه داخلی
با DMZ: اینترنت → فایروال → DMZ + فایروال → شبکه داخلی

اگر مهاجم یک وبسرور در DMZ را به خطر بیندازد، هنوز با یک فایروال دیگر برای رسیدن به شبکه داخلی روبرو میشود.

## الگوهای طراحی DMZ

### دو فایروال (توصیهشده برای تولید)
\`\`\`
اینترنت
    |
[فایروال 1 - Edge]
    |
   DMZ (192.168.1.0/24)
    |
[فایروال 2 - داخلی]
    |
شبکه داخلی (10.0.0.0/8)
\`\`\`

## قوانین فایروال برای DMZ

\`\`\`bash
# اجازه به اینترنت برای دسترسی به DMZ
iptables -A FORWARD -i eth0 -o eth1 -p tcp --dport 80 -j ACCEPT
iptables -A FORWARD -i eth0 -o eth1 -p tcp --dport 443 -j ACCEPT

# بلاک کردن DMZ به داخلی
iptables -A FORWARD -i eth1 -o eth2 -j DROP

# اجازه مدیریت از داخلی به DMZ
iptables -A FORWARD -i eth2 -o eth1 -p tcp --dport 22 -j ACCEPT

# پیشفرض: انکار
iptables -P FORWARD DROP
\`\`\`

## Reverse Proxy در DMZ

\`\`\`nginx
server {
    listen 443 ssl;
    server_name app.company.com;

    location / {
        # فوروارد به سرور داخلی
        proxy_pass http://10.0.1.10:8080;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
\`\`\`

## خلاصه

- DMZ سرویسهای رو به اینترنت را از شبکه داخلی جدا میکند
- از طراحی دو فایروال برای تولید استفاده کنید
- پیشفرض انکار بین DMZ و داخلی — فقط چیزی که صریحاً نیاز است را اجازه دهید
- از reverse proxy برای جلوگیری از دسترسی مستقیم اینترنت به سرورهای داخلی استفاده کنید
`,
  },
  'siem-log-management-elk': {
    contentEn: `## Introduction

A SIEM (Security Information and Event Management) system collects, correlates, and analyzes log data from across your infrastructure to detect security incidents. The ELK Stack (Elasticsearch, Logstash, Kibana) combined with Beats agents is a popular open-source SIEM platform.

## ELK Stack Components

- **Elasticsearch**: Stores and indexes log data, provides fast search
- **Logstash**: Log processing pipeline (parse, filter, enrich)
- **Kibana**: Web UI for dashboards and visualization
- **Filebeat/Metricbeat**: Lightweight agents that ship logs from servers
- **Elastic SIEM**: Built-in security detection in Kibana

## Quick Install with Docker Compose

\`\`\`yaml
# docker-compose.yml
version: '3'
services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    volumes:
      - esdata:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

  logstash:
    image: logstash:8.11.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

volumes:
  esdata:
\`\`\`

## Logstash Pipeline Configuration

\`\`\`ruby
# /logstash/pipeline/syslog.conf
input {
  beats {
    port => 5044
  }
}

filter {
  # Parse syslog format
  if [type] == "syslog" {
    grok {
      match => { "message" => "%{SYSLOGTIMESTAMP:syslog_timestamp} %{SYSLOGHOST:syslog_hostname} %{DATA:syslog_program}(?:\[%{POSINT:syslog_pid}\])?: %{GREEDYDATA:syslog_message}" }
    }
    date {
      match => [ "syslog_timestamp", "MMM  d HH:mm:ss", "MMM dd HH:mm:ss" ]
    }
  }

  # Enrich with GeoIP for external IPs
  if [src_ip] and [src_ip] !~ /^(10\.|192\.168\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[01]\.)/ {
    geoip {
      source => "src_ip"
      target => "geoip"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "logs-%{+YYYY.MM.dd}"
  }
}
\`\`\`

## Installing Filebeat on Servers

\`\`\`bash
# Install Filebeat on each server you want to monitor
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.11.0-amd64.deb
dpkg -i filebeat-8.11.0-amd64.deb

# Configure /etc/filebeat/filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/syslog
    - /var/log/auth.log
    - /var/log/nginx/*.log
  fields:
    type: syslog
    server: web01

output.logstash:
  hosts: ["logstash-server:5044"]

# Enable modules for common services
filebeat modules enable system nginx

# Start Filebeat
systemctl start filebeat
systemctl enable filebeat
\`\`\`

## Creating Kibana Dashboards

1. Go to Kibana → Stack Management → Index Patterns
2. Create pattern: \`logs-*\`
3. Go to Discover → search and filter logs
4. Go to Dashboard → Create → Add visualizations

### Useful Kibana Queries (KQL)
\`\`\`
# Failed SSH logins
event.type: authentication_failure

# Connections from a specific country
geoip.country_name: "Unknown"

# High frequency events from one IP
source.ip: 1.2.3.4

# Nginx 5xx errors
http.response.status_code >= 500
\`\`\`

## Security Detection Rules

Kibana SIEM has built-in detection rules. Enable them:

\`\`\`
Kibana → Security → Rules → Load Elastic prebuilt rules
\`\`\`

Common rules to enable:
- Linux: Unusual Process Execution
- Linux: SSH Brute Force
- Network: DNS Activity to Unusual TLD
- Windows: Credential Dumping

## Custom Alert with ElastAlert

\`\`\`yaml
# /etc/elastalert/rules/ssh_brute_force.yaml
name: SSH Brute Force
type: frequency
index: logs-*
num_events: 10
timeframe:
  minutes: 5
filter:
  - term:
      program: sshd
  - term:
      message: "Failed password"
alert:
  - email
email:
  - "security@company.com"
smtp_host: mail.company.com
\`\`\`

## Summary

- ELK Stack is a powerful open-source SIEM platform
- Deploy Filebeat agents on all servers to centralize logs
- Use Logstash pipelines to parse and enrich log data
- Create Kibana dashboards for real-time visibility
- Enable Elastic Security rules to detect common attack patterns
`,
    contentFa: `## مقدمه

SIEM (مدیریت اطلاعات و رویدادهای امنیتی) لاگها را از سراسر زیرساخت جمعآوری، همبسته و تحلیل میکند تا حوادث امنیتی را شناسایی کند. ELK Stack (Elasticsearch, Logstash, Kibana) یک پلتفرم متنباز محبوب برای این کار است.

## اجزای ELK Stack

- **Elasticsearch**: ذخیره و ایندکس دادههای لاگ
- **Logstash**: پردازش لاگ (تجزیه، فیلتر، غنیسازی)
- **Kibana**: رابط وب برای داشبورد و تجسم
- **Filebeat**: عامل سبک برای ارسال لاگ

## نصب سریع با Docker Compose

\`\`\`yaml
version: '3'
services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    ports:
      - "9200:9200"

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
\`\`\`

## نصب Filebeat روی سرورها

\`\`\`bash
apt install filebeat

# پیکربندی /etc/filebeat/filebeat.yml
filebeat.inputs:
- type: log
  paths:
    - /var/log/syslog
    - /var/log/auth.log
    - /var/log/nginx/*.log

output.elasticsearch:
  hosts: ["elasticsearch-server:9200"]

systemctl start filebeat && systemctl enable filebeat
\`\`\`

## خلاصه

- ELK Stack یک پلتفرم SIEM متنباز قدرتمند است
- Filebeat را روی تمام سرورها نصب کنید تا لاگها را متمرکز کنید
- از قوانین Elastic Security برای شناسایی الگوهای حمله رایج استفاده کنید
- داشبوردهای Kibana برای دید لحظهای ایجاد کنید
`,
  },
  'ssl-vpn-openvpn-wireguard': {
    contentEn: `## Introduction

SSL VPN allows remote users to connect to your corporate network over the internet using standard HTTPS/UDP ports. The two main open-source options are OpenVPN (mature, feature-rich) and WireGuard (modern, faster, simpler). This guide covers both.

## OpenVPN Setup (Server Side)

\`\`\`bash
# Install OpenVPN and EasyRSA
apt install openvpn easy-rsa

# Set up PKI
make-cadir /etc/openvpn/easy-rsa
cd /etc/openvpn/easy-rsa
./easyrsa init-pki
./easyrsa build-ca nopass
./easyrsa gen-req server nopass
./easyrsa sign-req server server
./easyrsa gen-dh
openvpn --genkey secret /etc/openvpn/ta.key
\`\`\`

### Server Configuration

\`\`\`
# /etc/openvpn/server.conf
port 1194
proto udp
dev tun

ca   /etc/openvpn/easy-rsa/pki/ca.crt
cert /etc/openvpn/easy-rsa/pki/issued/server.crt
key  /etc/openvpn/easy-rsa/pki/private/server.key
dh   /etc/openvpn/easy-rsa/pki/dh.pem
tls-auth /etc/openvpn/ta.key 0

server 10.8.0.0 255.255.255.0
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 8.8.8.8"

keepalive 10 120
cipher AES-256-GCM
auth SHA256
tls-version-min 1.2
user nobody
group nogroup
persist-key
persist-tun
log /var/log/openvpn.log
verb 3
\`\`\`

\`\`\`bash
# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward
# Add to /etc/sysctl.conf: net.ipv4.ip_forward=1

# NAT for VPN clients
iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o eth0 -j MASQUERADE

# Start OpenVPN
systemctl start openvpn@server
systemctl enable openvpn@server
\`\`\`

## Creating Client Certificates (OpenVPN)

\`\`\`bash
cd /etc/openvpn/easy-rsa
./easyrsa gen-req client1 nopass
./easyrsa sign-req client client1
\`\`\`

### Client .ovpn File

\`\`\`
client
dev tun
proto udp
remote vpn.company.com 1194

ca   ca.crt
cert client1.crt
key  client1.key
tls-auth ta.key 1

cipher AES-256-GCM
auth SHA256
verb 3
\`\`\`

## WireGuard Setup (Simpler, Faster)

WireGuard is built into Linux kernel 5.6+, uses modern cryptography (Curve25519, ChaCha20).

\`\`\`bash
# Install
apt install wireguard

# Generate server keys
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key

# Generate client keys
wg genkey | tee /etc/wireguard/client1_private.key | wg pubkey > /etc/wireguard/client1_public.key
\`\`\`

### Server Config

\`\`\`ini
# /etc/wireguard/wg0.conf
[Interface]
Address = 10.9.0.1/24
ListenPort = 51820
PrivateKey = <server_private_key>
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Client 1
PublicKey = <client1_public_key>
AllowedIPs = 10.9.0.2/32
\`\`\`

### Client Config

\`\`\`ini
[Interface]
Address = 10.9.0.2/24
PrivateKey = <client1_private_key>
DNS = 8.8.8.8

[Peer]
PublicKey = <server_public_key>
Endpoint = vpn.company.com:51820
AllowedIPs = 0.0.0.0/0    # Route all traffic through VPN
PersistentKeepalive = 25
\`\`\`

\`\`\`bash
# Start WireGuard
wg-quick up wg0
systemctl enable wg-quick@wg0

# Check status
wg show
\`\`\`

## OpenVPN vs WireGuard Comparison

| Feature | OpenVPN | WireGuard |
|---------|---------|-----------|
| Protocol | SSL/TLS | UDP only |
| Speed | Moderate | Very fast |
| Configuration | Complex | Simple |
| Kernel integration | Userspace | Kernel module |
| Mobile support | Good | Excellent |
| Dynamic IP clients | Yes (with DDNS) | Needs extra config |
| Audit history | Long | Short (new) |

## Split Tunneling

Route only corporate traffic through VPN, rest goes direct:

\`\`\`
# OpenVPN: remove "redirect-gateway" and add specific routes
push "route 10.0.0.0 255.0.0.0"
push "route 192.168.0.0 255.255.0.0"

# WireGuard client: change AllowedIPs
AllowedIPs = 10.0.0.0/8, 192.168.0.0/16
\`\`\`

## Summary

- OpenVPN: battle-tested, works everywhere, more configuration options
- WireGuard: simpler, faster, modern crypto — prefer for new deployments
- Always use split tunneling unless you specifically need all traffic routed through VPN
- Monitor active VPN connections and alert on unusual login times/locations
`,
    contentFa: `## مقدمه

SSL VPN به کاربران از راه دور اجازه میدهد از طریق اینترنت به شبکه شرکت متصل شوند. OpenVPN (بالغ، پر امکانات) و WireGuard (مدرن، سریعتر، سادهتر) دو گزینه اصلی متنباز هستند.

## راهاندازی OpenVPN

\`\`\`bash
apt install openvpn easy-rsa

make-cadir /etc/openvpn/easy-rsa
cd /etc/openvpn/easy-rsa
./easyrsa init-pki
./easyrsa build-ca nopass
./easyrsa gen-req server nopass
./easyrsa sign-req server server
./easyrsa gen-dh
\`\`\`

## پیکربندی WireGuard (سادهتر و سریعتر)

\`\`\`bash
apt install wireguard

# تولید کلیدها
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
\`\`\`

### پیکربندی سرور WireGuard

\`\`\`ini
[Interface]
Address = 10.9.0.1/24
ListenPort = 51820
PrivateKey = <کلید_خصوصی_سرور>

[Peer]
PublicKey = <کلید_عمومی_کلاینت>
AllowedIPs = 10.9.0.2/32
\`\`\`

### پیکربندی کلاینت

\`\`\`ini
[Interface]
Address = 10.9.0.2/24
PrivateKey = <کلید_خصوصی_کلاینت>

[Peer]
PublicKey = <کلید_عمومی_سرور>
Endpoint = vpn.company.com:51820
AllowedIPs = 10.0.0.0/8
\`\`\`

## مقایسه OpenVPN و WireGuard

| ویژگی | OpenVPN | WireGuard |
|-------|---------|-----------|
| سرعت | متوسط | خیلی سریع |
| پیچیدگی | زیاد | کم |
| یکپارچگی کرنل | Userspace | ماژول کرنل |

## خلاصه

- WireGuard را برای استقرارهای جدید ترجیح دهید — سادهتر و سریعتر است
- OpenVPN برای محیطهایی که نیاز به سازگاری گسترده دارند مناسب است
- از Split Tunneling استفاده کنید تا فقط ترافیک شرکت از VPN عبور کند
`,
  },
  'email-security-spf-dkim-dmarc': {
    contentEn: `## Introduction

Email spoofing — where attackers forge the sender address to impersonate your domain — is one of the most common attack vectors for phishing. Three DNS-based mechanisms work together to prevent this: SPF, DKIM, and DMARC.

## SPF (Sender Policy Framework)

SPF tells the world which mail servers are authorized to send email from your domain. It's a DNS TXT record.

### Creating an SPF Record

\`\`\`
# Basic SPF record
example.com. IN TXT "v=spf1 mx a:mail.example.com include:_spf.google.com ~all"
\`\`\`

Breaking it down:
- \`v=spf1\` — SPF version 1
- \`mx\` — allow your MX servers to send
- \`a:mail.example.com\` — allow this specific server
- \`include:_spf.google.com\` — if using Google Workspace for email
- \`~all\` — soft fail anything else (use \`-all\` for hard fail after testing)

### Testing SPF

\`\`\`bash
# Check your SPF record
dig TXT example.com | grep spf

# Test from command line
python3 -c "
import dns.resolver
result = dns.resolver.resolve('example.com', 'TXT')
for r in result:
    if 'spf' in str(r).lower():
        print(r)
"

# Online tools: mxtoolbox.com/spf.aspx
\`\`\`

## DKIM (DomainKeys Identified Mail)

DKIM adds a cryptographic signature to outgoing emails. The receiving server verifies the signature using a public key in your DNS.

### Generating DKIM Keys (Postfix + OpenDKIM)

\`\`\`bash
# Install OpenDKIM
apt install opendkim opendkim-tools

# Generate key pair
mkdir -p /etc/opendkim/keys/example.com
opendkim-genkey -D /etc/opendkim/keys/example.com/ -d example.com -s mail
# Creates:
#   mail.private (private key — keep on mail server)
#   mail.txt     (public key — put in DNS)

# Set permissions
chown -R opendkim:opendkim /etc/opendkim/keys/
chmod 600 /etc/opendkim/keys/example.com/mail.private
\`\`\`

### OpenDKIM Configuration

\`\`\`
# /etc/opendkim.conf
Syslog          yes
SyslogSuccess   yes
LogWhy          yes
Mode            sv
SubDomains      no
Domain          example.com
KeyFile         /etc/opendkim/keys/example.com/mail.private
Selector        mail
Socket          local:/var/spool/postfix/opendkim/opendkim.sock
\`\`\`

### DNS Record for DKIM

The content of \`mail.txt\` goes in DNS:

\`\`\`
mail._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GN..."
\`\`\`

## DMARC (Domain-based Message Authentication, Reporting & Conformance)

DMARC ties SPF and DKIM together and tells receiving servers what to do when they fail.

### DMARC Record

\`\`\`
# Start with monitor mode (p=none) to see what's happening
_dmarc.example.com. IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; fo=1"

# After reviewing reports, move to quarantine
_dmarc.example.com. IN TXT "v=DMARC1; p=quarantine; pct=50; rua=mailto:dmarc@example.com"

# Finally, reject unauthenticated emails
_dmarc.example.com. IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
\`\`\`

DMARC parameters:
- \`p=none\` — monitor only, don't filter
- \`p=quarantine\` — send to spam folder
- \`p=reject\` — reject the email entirely
- \`pct=50\` — apply policy to 50% of emails (ramp up gradually)
- \`rua\` — aggregate report destination
- \`ruf\` — forensic report destination (individual failed emails)

### Reading DMARC Reports

\`\`\`bash
# DMARC reports arrive as XML in email, gzip compressed
# Use parsedmarc to analyze them
pip install parsedmarc

parsedmarc /path/to/dmarc-report.xml
# Shows which servers sent email, SPF/DKIM pass/fail rates
\`\`\`

## Email Authentication Header

After implementing, check outgoing email headers:

\`\`\`
Authentication-Results: mx.google.com;
   dkim=pass header.i=@example.com header.s=mail header.b=AbCdEfGh;
   spf=pass (google.com: domain of user@example.com designates 203.0.113.1 as permitted sender);
   dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=example.com
\`\`\`

All three should show \`pass\`.

## Implementation Checklist

\`\`\`
[ ] Publish SPF record — start with ~all (soft fail)
[ ] Install and configure OpenDKIM
[ ] Publish DKIM public key in DNS
[ ] Publish DMARC with p=none and rua address
[ ] Wait 2 weeks and review aggregate reports
[ ] Fix any legitimate servers not covered by SPF/DKIM
[ ] Move DMARC to p=quarantine with pct=10, increase gradually
[ ] Move to p=reject when confident all legitimate mail is passing
\`\`\`

## Summary

- SPF defines which servers can send email for your domain
- DKIM cryptographically signs emails — proves they weren't tampered with
- DMARC tells receivers what to do when SPF/DKIM fail, and sends you reports
- Always start with DMARC p=none and monitor before enforcing
- All three are required for good email deliverability and anti-spoofing
`,
    contentFa: `## مقدمه

جعل ایمیل (Email Spoofing) که در آن مهاجمان آدرس فرستنده را جعل میکنند، یکی از رایجترین روشهای فیشینگ است. سه مکانیزم مبتنی بر DNS با هم کار میکنند تا این کار را جلوگیری کنند: SPF، DKIM و DMARC.

## SPF (Sender Policy Framework)

SPF مشخص میکند کدام سرورها مجاز هستند از طرف دامنه شما ایمیل ارسال کنند.

\`\`\`
# رکورد SPF پایه
example.com. IN TXT "v=spf1 mx a:mail.example.com include:_spf.google.com ~all"
\`\`\`

## DKIM (DomainKeys Identified Mail)

DKIM یک امضای رمزنگاری به ایمیلهای خروجی اضافه میکند.

\`\`\`bash
# نصب OpenDKIM
apt install opendkim opendkim-tools

# تولید جفت کلید
mkdir -p /etc/opendkim/keys/example.com
opendkim-genkey -D /etc/opendkim/keys/example.com/ -d example.com -s mail
\`\`\`

### رکورد DNS برای DKIM

\`\`\`
mail._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=<کلید_عمومی>"
\`\`\`

## DMARC

DMARC SPF و DKIM را به هم متصل میکند و به سرورهای دریافتکننده میگوید در صورت شکست چه کاری انجام دهند.

\`\`\`
# شروع با حالت مانیتور
_dmarc.example.com. IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@example.com"

# بعد از بررسی گزارشها
_dmarc.example.com. IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
\`\`\`

## چکلیست پیادهسازی

\`\`\`
[ ] انتشار رکورد SPF با ~all
[ ] نصب OpenDKIM و انتشار کلید عمومی
[ ] انتشار DMARC با p=none
[ ] بررسی گزارشهای دو هفتهای
[ ] تغییر به p=quarantine و سپس p=reject
\`\`\`

## خلاصه

- SPF مشخص میکند کدام سرورها مجاز به ارسال ایمیل هستند
- DKIM ایمیلها را امضای رمزنگاری میکند
- DMARC گزارش میدهد و اجرا میکند
- همیشه با DMARC p=none شروع کنید و قبل از اجرا مانیتور کنید
`,
  },
  'ransomware-defense-strategy': {
    contentEn: `## Introduction

Ransomware encrypts your data and demands payment for decryption. Modern ransomware operators are sophisticated — they spend weeks mapping your network before striking, exfiltrate data for double extortion, and target backups first. Defense requires a layered approach.

## The Attack Chain

Understanding how ransomware works helps you block it:

1. **Initial Access**: Phishing email, exposed RDP, VPN vulnerability, supply chain
2. **Persistence**: Create admin accounts, disable security tools, install backdoors
3. **Lateral Movement**: Spread through network using stolen credentials
4. **Discovery**: Map network, find backup systems, domain controllers
5. **Impact**: Disable backups, encrypt everything simultaneously

## Backup Strategy: The 3-2-1-1-0 Rule

The most important defense is immutable, tested backups:

- **3** copies of data
- **2** different storage types (disk + tape, or disk + cloud)
- **1** offsite copy
- **1** offline/immutable copy (air-gapped or immutable cloud storage)
- **0** unverified backups — test restores regularly

### Immutable Backups Setup

\`\`\`bash
# AWS S3 with Object Lock (WORM - Write Once Read Many)
aws s3api create-bucket --bucket company-backups --region us-east-1
aws s3api put-object-lock-configuration   --bucket company-backups   --object-lock-configuration   '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Days":30}}}'

# Veeam: enable immutable backups to S3-compatible storage
# In Veeam: Edit job → Storage → Object Storage → Enable "Make recent backups immutable for X days"
\`\`\`

### Offsite Backup with Rclone

\`\`\`bash
# Install rclone
curl https://rclone.org/install.sh | bash

# Configure remote (S3, Backblaze B2, Wasabi, etc.)
rclone config

# Sync backups offsite
rclone sync /backup/local remote:bucket-name/server1/ --progress

# Cron job: daily offsite sync
0 2 * * * /usr/bin/rclone sync /backup/local remote:bucket-name/server1/ --log-file=/var/log/rclone.log
\`\`\`

## Endpoint Protection

\`\`\`bash
# Linux: Install ClamAV antivirus
apt install clamav clamav-daemon
systemctl start clamav-freshclam
systemctl start clamav-daemon

# Scan directory
clamscan -r /home --log=/var/log/clamav-scan.log

# Real-time scanning with clamd
# Configure /etc/clamav/clamd.conf:
# OnAccessIncludePath /home
# OnAccessExcludeRootUID yes
\`\`\`

## Network Segmentation

Ransomware spreads laterally. Segmentation limits blast radius:

\`\`\`bash
# Separate VLANs for:
# - User workstations (VLAN 10)
# - Servers (VLAN 20)
# - Backup systems (VLAN 30 — most restricted)
# - Management (VLAN 99)

# Firewall rules between VLANs:
# Workstations cannot initiate connections to backup VLAN
# Backup VLAN: only backup server IPs can connect

iptables -A FORWARD -s 192.168.10.0/24 -d 192.168.30.0/24 -j DROP  # Block workstations → backups
\`\`\`

## Disabling Common Attack Vectors

\`\`\`bash
# Disable RDP if not needed (major ransomware entry point)
systemctl stop xrdp
systemctl disable xrdp

# Block SMBv1 (used by EternalBlue/WannaCry)
# Windows: Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol
# Linux Samba:
# /etc/samba/smb.conf: min protocol = SMB2

# Restrict PowerShell (Windows) — require signed scripts
# Set-ExecutionPolicy AllSigned

# Disable macros in Office files
# Group Policy: User Config → Admin Templates → Microsoft Office → Security
\`\`\`

## Detection: Honeypot Files

Place "canary" files that should never be accessed. Alert immediately if touched:

\`\`\`bash
# Create honeypot files in common ransomware targets
touch /shared/finance/DO_NOT_OPEN_CANARY.docx
touch /shared/hr/DO_NOT_OPEN_CANARY.xlsx

# Monitor with inotifywait
inotifywait -m /shared -e access,modify -r |
while read path action file; do
  if echo "$file" | grep -q "CANARY"; then
    echo "ALERT: Ransomware canary accessed! $path$file" | mail -s "RANSOMWARE ALERT" security@company.com
  fi
done
\`\`\`

## Incident Response Plan

Document before an incident occurs:

\`\`\`
1. ISOLATE: Disconnect affected systems from network immediately
   - Don't turn off — forensics needs memory
   - Block at switch port level if possible

2. IDENTIFY: Determine scope
   - Which systems are encrypted?
   - What was the entry point?
   - Are backups intact?

3. CONTAIN: Prevent further spread
   - Change all admin passwords
   - Revoke compromised credentials
   - Disable affected accounts

4. RECOVER: Restore from backups
   - Restore to clean hardware/VMs
   - Test before reconnecting to network
   - Patch the vulnerability first

5. REPORT: Notify stakeholders
   - Management, legal, insurance
   - Regulatory bodies if required (GDPR, etc.)
   - Law enforcement (FBI IC3, local police)
\`\`\`

## Security Hardening Checklist

\`\`\`bash
# 1. Enable Windows Defender / Linux auditd
systemctl start auditd
auditctl -w /etc -p wa -k config-change

# 2. Disable unnecessary services
systemctl disable telnet rsh cups

# 3. Enable application whitelisting (Linux: AppArmor)
systemctl enable apparmor
aa-enforce /etc/apparmor.d/*

# 4. Password policy
# /etc/security/pwquality.conf
minlen = 14
minclass = 3
maxrepeat = 2
\`\`\`

## Summary

- Backups are your most important defense — use 3-2-1-1-0 rule with immutable copies
- Segment networks so ransomware can't spread from workstations to servers to backups
- Patch systems quickly — most ransomware exploits known vulnerabilities
- Train users on phishing — it's still the #1 entry point
- Practice your incident response plan before you need it
`,
    contentFa: `## مقدمه

باجافزار دادههای شما را رمزگذاری میکند و برای رمزگشایی باج میخواهد. دفاع در برابر آن نیازمند رویکردی لایهای است.

## استراتژی بکاپ: قانون 3-2-1-1-0

مهمترین دفاع، بکاپهای تغییرناپذیر و تستشده است:

- **3** نسخه از داده
- **2** نوع ذخیرهسازی متفاوت
- **1** نسخه خارج از سایت
- **1** نسخه آفلاین/تغییرناپذیر
- **0** بکاپ تأییدنشده

## بکاپ تغییرناپذیر با AWS S3

\`\`\`bash
aws s3api put-object-lock-configuration   --bucket company-backups   --object-lock-configuration   '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Days":30}}}'
\`\`\`

## تشخیص: فایلهای Honeypot

\`\`\`bash
# ایجاد فایلهای طعمه
touch /shared/DO_NOT_OPEN_CANARY.docx

# مانیتورینگ
inotifywait -m /shared -e access,modify -r |
while read path action file; do
  if echo "$file" | grep -q "CANARY"; then
    echo "ALERT: باجافزار شناسایی شد!" | mail -s "هشدار" security@company.com
  fi
done
\`\`\`

## پلن پاسخ به حادثه

\`\`\`
1. ایزوله: سیستمهای آسیبدیده را فوری از شبکه جدا کنید
2. شناسایی: کدام سیستمها رمزگذاری شدهاند؟ آیا بکاپها سالم هستند؟
3. مهار: همه رمزهای عبور ادمین را تغییر دهید
4. بازیابی: از بکاپها روی سختافزار تمیز بازیابی کنید
5. گزارش: مدیریت، بیمه، مراجع قانونی را مطلع کنید
\`\`\`

## خلاصه

- بکاپها مهمترین دفاع هستند — از قانون 3-2-1-1-0 با نسخههای تغییرناپذیر استفاده کنید
- شبکه را سگمنت کنید تا باجافزار نتواند از ورکاستیشن به سرور و بکاپ گسترش یابد
- سیستمها را سریع پچ کنید — بیشتر باجافزارها آسیبپذیریهای شناختهشده را استثمار میکنند
- کاربران را در مورد فیشینگ آموزش دهید
`,
  },
  'vulnerability-scanning-openvas': {
    contentEn: `## Introduction

Vulnerability scanning identifies known security weaknesses in your systems before attackers do. OpenVAS (Open Vulnerability Assessment System), now part of Greenbone Vulnerability Management (GVM), is the leading open-source vulnerability scanner with 50,000+ Network Vulnerability Tests (NVTs).

## Installing GVM (OpenVAS)

### Method 1: Docker (Recommended for Quick Start)

\`\`\`bash
docker pull greenbone/community-edition
docker-compose -f docker-compose-ce.yml up -d

# Access at https://localhost:9392
# Default credentials: admin / admin
\`\`\`

### Method 2: Native Install on Ubuntu

\`\`\`bash
# Add Greenbone repository
curl -o /etc/apt/sources.list.d/greenbone.list https://greenbone.github.io/install-packages/greenbone-ce-ubuntu-20.04.list

apt install gvm

# Initialize GVM
gvm-setup
# This downloads NVT feed (~500MB) — takes 20-40 minutes

# Start services
gvm-start

# Check status
gvm-check-setup
\`\`\`

## First Scan with GVM

### Via Web Interface (Greenbone Security Assistant)

1. Login to \`https://your-server:9392\`
2. **Scans → Tasks → New Task**
3. Configure:
   - Name: "Initial Network Scan"
   - Scan Config: "Full and Fast"
   - Target: Add new target with IP ranges
4. Click Save → Start Task

### Via Command Line (gvm-cli)

\`\`\`bash
# Install CLI client
pip install gvm-tools

# Connect and create target
gvm-cli socket --gvm-socket /run/gvmd/gvmd.sock --xml   "<create_target><name>Internal Network</name><hosts>192.168.1.0/24</hosts></create_target>"

# Create and start task
gvm-cli socket --gvm-socket /run/gvmd/gvmd.sock --xml   "<create_task><name>Full Scan</name><config id='daba56c8-73ec-11df-a475-002264764cea'/><target id='TARGET_ID'/></create_task>"
\`\`\`

## Understanding Scan Results

Results are categorized by CVSS score:

| Severity | CVSS Score | Action |
|----------|-----------|--------|
| Critical | 9.0 - 10.0 | Fix immediately |
| High | 7.0 - 8.9 | Fix within 24 hours |
| Medium | 4.0 - 6.9 | Fix within 30 days |
| Low | 0.1 - 3.9 | Fix in next maintenance window |
| Info | 0 | Review, informational only |

## Reading a Vulnerability Report

Example vulnerability output:
\`\`\`
NVT: Apache HTTP Server Multiple Vulnerabilities (CVE-2023-25690)
Severity: Critical (9.8)
Host: 192.168.1.10
Port: 443/tcp

Summary:
Apache HTTP Server 2.4.0 through 2.4.55 is affected by...

Solution Type: VendorFix
Solution: Update to Apache 2.4.56 or later
\`\`\`

## Remediation Workflow

\`\`\`bash
# 1. Export findings as CSV
# GVM: Scans → Reports → Download (CSV format)

# 2. Prioritize by CVSS score
sort -t',' -k5 -rn vulnerabilities.csv | head 20

# 3. Fix critical vulnerabilities
# Example: Update Apache
apt update && apt install apache2

# 4. Re-scan to verify fix
# Run targeted scan on just that host

# 5. Mark as resolved in GVM
# Notes & Overrides → Add Note to suppress confirmed-fixed findings
\`\`\`

## Scheduled Scanning

\`\`\`bash
# In GVM: Scans → Schedules → New Schedule
# Set: Run daily at 2am, repeat weekly

# Or via CLI
gvm-cli socket --xml   "<create_schedule>
    <name>Weekly Scan</name>
    <icalendar>DTSTART:20240101T020000Z
RRULE:FREQ=WEEKLY</icalendar>
    <timezone>UTC</timezone>
  </create_schedule>"
\`\`\`

## Scanning Different Target Types

\`\`\`bash
# Network scan (most common)
# Target: 192.168.1.0/24

# Single host deep scan
# Target: 192.168.1.10
# Scan config: "Full and very deep"

# Web application scan
# Use "Web Application Tests" scan config
# Target: https://app.company.com

# Authenticated scan (better results, needs credentials)
# In GVM: Credentials → New Credential
# Add SSH username/password for Linux targets
# Add SMB credentials for Windows targets
# Attach credentials to target configuration
\`\`\`

## Complementary Tools

\`\`\`bash
# Nmap for quick port discovery (before GVM scan)
nmap -sV -p- --open 192.168.1.0/24 -oN nmap-results.txt

# Nikto for web server scanning
nikto -h http://192.168.1.10

# testssl.sh for SSL/TLS issues
./testssl.sh https://example.com

# Lynis for Linux host hardening audit
apt install lynis
lynis audit system
\`\`\`

## Summary

- Run vulnerability scans regularly — weekly for internet-facing systems, monthly for internal
- Use authenticated scans for more accurate results
- Prioritize by CVSS score — fix Critical and High first
- Always re-scan after patching to confirm the fix
- GVM/OpenVAS is excellent open-source; Qualys, Nessus, Rapid7 for enterprise
`,
    contentFa: `## مقدمه

اسکن آسیبپذیری نقاط ضعف امنیتی شناختهشده در سیستمهای شما را قبل از مهاجمان شناسایی میکند. OpenVAS/GVM پیشروترین اسکنر آسیبپذیری متنباز با بیش از 50,000 تست است.

## نصب GVM با Docker

\`\`\`bash
docker pull greenbone/community-edition
docker-compose up -d

# دسترسی: https://localhost:9392
# اعتبارنامه پیشفرض: admin / admin
\`\`\`

## نصب Native روی اوبونتو

\`\`\`bash
apt install gvm

# راهاندازی (دانلود فید NVT — ۲۰-۴۰ دقیقه)
gvm-setup

# شروع سرویسها
gvm-start

# بررسی وضعیت
gvm-check-setup
\`\`\`

## درک نتایج اسکن

| شدت | امتیاز CVSS | اقدام |
|-----|------------|-------|
| بحرانی | 9.0 - 10.0 | فوری رفع کنید |
| بالا | 7.0 - 8.9 | ظرف 24 ساعت |
| متوسط | 4.0 - 6.9 | ظرف 30 روز |
| پایین | 0.1 - 3.9 | در پنجره نگهداری بعدی |

## ابزارهای مکمل

\`\`\`bash
# Nmap برای کشف سریع پورت
nmap -sV -p- --open 192.168.1.0/24

# Nikto برای اسکن وب سرور
nikto -h http://192.168.1.10

# Lynis برای ممیزی سختسازی لینوکس
apt install lynis && lynis audit system
\`\`\`

## خلاصه

- اسکنهای آسیبپذیری را بهطور منظم اجرا کنید
- از اسکنهای احراز هویتشده برای نتایج دقیقتر استفاده کنید
- بر اساس امتیاز CVSS اولویتبندی کنید
- همیشه بعد از پچ کردن دوباره اسکن کنید
`,
  },
  'lxc-lxd-containers-linux': {
    contentEn: `## Introduction

LXC (Linux Containers) and LXD (a hypervisor for LXC) allow you to run full Linux system containers — lighter than VMs but more isolated than Docker. LXD adds a REST API, a CLI, clustering, and storage/network management on top of LXC.

## LXC vs Docker vs VM

| Feature | Docker | LXC/LXD | VM |
|---------|--------|---------|-----|
| Isolation | Process | System | Full hardware |
| OS kernel | Shared | Shared | Separate |
| Boot time | Seconds | Seconds | Minutes |
| Use case | Apps | Full Linux systems | Full isolation |
| Systemd | No | Yes | Yes |

## Installing LXD

\`\`\`bash
# Ubuntu (snap)
snap install lxd

# Initialize LXD (interactive)
lxd init
# Answer: storage pool=dir or zfs, networking=yes (creates lxdbr0), clustering=no for single node
\`\`\`

## Basic Container Operations

\`\`\`bash
# Launch a container
lxc launch ubuntu:22.04 web-server-1

# List containers
lxc list

# Enter container shell
lxc exec web-server-1 -- bash

# Stop/start
lxc stop web-server-1
lxc start web-server-1

# Delete
lxc delete web-server-1 --force
\`\`\`

## Container Configuration

\`\`\`bash
# Set memory limit
lxc config set web-server-1 limits.memory 2GB

# Set CPU limit
lxc config set web-server-1 limits.cpu 2

# View all config
lxc config show web-server-1

# Resource limits persist across reboots
\`\`\`

## Networking

\`\`\`bash
# View container IP
lxc list  # Shows IPv4/IPv6

# Add a bridged NIC (direct access to physical network)
lxc config device add web-server-1 eth1 nic nictype=bridged parent=eth0

# Port forwarding from host to container
lxc config device add web-server-1 myport proxy listen=tcp:0.0.0.0:80 connect=tcp:127.0.0.1:80
\`\`\`

## Storage

\`\`\`bash
# Create a disk device
lxc storage create data-pool dir source=/data/lxd

# Add disk to container
lxc config device add web-server-1 data disk source=/data/websites path=/var/www

# Or create a new volume
lxc storage volume create default web-data
lxc config device add web-server-1 web-data disk pool=default source=web-data path=/var/www
\`\`\`

## Snapshots and Migration

\`\`\`bash
# Take snapshot
lxc snapshot web-server-1 before-upgrade

# List snapshots
lxc info web-server-1 | grep Snapshots -A 20

# Restore snapshot
lxc restore web-server-1 before-upgrade

# Copy container to another host
lxc copy web-server-1 web-server-2
lxc move web-server-1 remote-host:web-server-1
\`\`\`

## Profiles (Templates)

Profiles let you reuse configuration:

\`\`\`bash
# Create profile for web servers
lxc profile create webserver
lxc profile set webserver limits.memory 2GB
lxc profile set webserver limits.cpu 2
lxc profile device add webserver eth0 nic nictype=bridged parent=lxdbr0

# Apply profile to new container
lxc launch ubuntu:22.04 new-web --profile default --profile webserver
\`\`\`

## Production Hardening

\`\`\`bash
# Prevent container from seeing host processes
lxc config set web-server-1 security.idmap.isolated true

# Disable nesting (prevents container-in-container)
lxc config set web-server-1 security.nesting false

# Enable AppArmor
lxc config set web-server-1 raw.lxc "lxc.apparmor.profile=generated"

# Restrict capabilities
lxc config set web-server-1 linux.kernel_modules ""
\`\`\`

## LXD Clustering (Multi-Host)

\`\`\`bash
# On node 1 (first node)
lxd init --preseed << EOF
cluster:
  enabled: true
  server_name: node1
  server_address: 192.168.1.10:8443
EOF

# On node 2 (join existing cluster)
lxd init --preseed << EOF
cluster:
  enabled: true
  server_name: node2
  server_address: 192.168.1.11:8443
  cluster_address: 192.168.1.10:8443
  cluster_token: TOKEN_FROM_NODE1
EOF

# View cluster members
lxc cluster list

# Launch on specific node
lxc launch ubuntu:22.04 container1 --target node2
\`\`\``,
    contentFa: `## مقدمه

LXC/LXD به شما اجازه می‌دهند کانتینرهای سیستم لینوکس کامل را اجرا کنید — سبک‌تر از VM اما ایزوله‌تر از Docker.

## عملیات اولیه کانتینر

\`\`\`bash
lxc launch ubuntu:22.04 web-server-1
lxc list
lxc exec web-server-1 -- bash
lxc stop web-server-1
lxc start web-server-1
\`\`\`

## پیکربندی کانتینر

\`\`\`bash
lxc config set web-server-1 limits.memory 2GB
lxc config set web-server-1 limits.cpu 2
lxc config show web-server-1
\`\`\`

## شبکه‌بندی

\`\`\`bash
# فوروارد پورت از هاست به کانتینر
lxc config device add web-server-1 myport proxy listen=tcp:0.0.0.0:80 connect=tcp:127.0.0.1:80
\`\`\`

## اسنپشات و مهاجرت

\`\`\`bash
lxc snapshot web-server-1 before-upgrade
lxc restore web-server-1 before-upgrade
lxc copy web-server-1 web-server-2
\`\`\`

## پروفایل‌ها

\`\`\`bash
lxc profile create webserver
lxc profile set webserver limits.memory 2GB
lxc launch ubuntu:22.04 new-web --profile default --profile webserver
\`\`\``,
  },
  'bash-scripting-sysadmin': {
    contentEn: `## Introduction

Bash scripting automates repetitive sysadmin tasks — from backups and log rotation to deployment pipelines and health checks. This guide covers practical Bash scripting patterns used in real production environments.

## Script Structure Best Practices

\`\`\`bash
#!/bin/bash
set -euo pipefail
# -e: exit on error
# -u: error on undefined variable
# -o pipefail: catch errors in pipes

# Script metadata
readonly SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="/var/log/myscript.log"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Cleanup on exit
cleanup() {
    local exit_code=$?
    echo "Script exited with code: $exit_code" >> "$LOG_FILE"
    # Remove temp files
    rm -f /tmp/myscript_$$.*
}
trap cleanup EXIT

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Script started"
\`\`\`

## Functions and Error Handling

\`\`\`bash
# Function with return value
check_disk_usage() {
    local mount_point="$1"
    local threshold="\${2:-85}"  # default 85%
    
    local usage=$(df "$mount_point" | awk 'NR==2 {print $5}' | tr -d '%')
    
    if [[ "$usage" -gt "$threshold" ]]; then
        log "WARNING: $mount_point is \${usage}% full (threshold: \${threshold}%)"
        return 1
    fi
    
    log "OK: $mount_point is \${usage}% full"
    return 0
}

# Call the function
if ! check_disk_usage /var 90; then
    # Send alert
    echo "Disk alert on $(hostname)" | mail -s "Disk Alert" admin@company.com
fi
\`\`\`

## Practical Script: System Health Check

\`\`\`bash
#!/bin/bash
set -euo pipefail

REPORT=""
ALERTS=""
HOSTNAME=$(hostname -f)

report() { REPORT+="$1
"; }
alert() { ALERTS+="ALERT: $1
"; }

# CPU Load
cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | tr -d ' ')
report "CPU Load (1min): $cpu_load"
if (( $(echo "$cpu_load > 4.0" | bc -l) )); then
    alert "High CPU load: $cpu_load"
fi

# Memory
mem_free_pct=$(free | awk 'NR==2{printf "%.0f", $4/$2*100}')
report "Memory free: \${mem_free_pct}%"
if [[ "$mem_free_pct" -lt 10 ]]; then
    alert "Low memory: only \${mem_free_pct}% free"
fi

# Disk usage on all mounts
while IFS= read -r line; do
    mount=$(echo "$line" | awk '{print $6}')
    usage=$(echo "$line" | awk '{print $5}' | tr -d '%')
    report "Disk $mount: \${usage}%"
    if [[ "$usage" -gt 85 ]]; then
        alert "Disk $mount is \${usage}% full"
    fi
done < <(df -h --output=source,size,used,avail,pcent,target | tail -n +2)

# Services check
for service in nginx mysql sshd; do
    if systemctl is-active --quiet "$service"; then
        report "Service $service: running"
    else
        alert "Service $service is NOT running"
    fi
done

# Send report
echo -e "$REPORT" | mail -s "Health Report: $HOSTNAME" admin@company.com

if [[ -n "$ALERTS" ]]; then
    echo -e "$ALERTS" | mail -s "ALERT: $HOSTNAME Health Issues" oncall@company.com
fi
\`\`\`

## String Manipulation

\`\`\`bash
# Trim whitespace
trim() {
    local str="$1"
    str="\${str#"\${str%%[![:space:]]*}"}"   # ltrim
    str="\${str%"\${str##*[![:space:]]}"}"   # rtrim
    echo "$str"
}

# Extract part of string
filename="backup_2024-01-15_prod.tar.gz"
date_part="\${filename#backup_}"           # Remove prefix: 2024-01-15_prod.tar.gz
date_only="\${date_part%%_*}"              # Up to first _: 2024-01-15
echo "$date_only"

# String contains
if [[ "$hostname" == *"prod"* ]]; then
    echo "This is a production server"
fi
\`\`\`

## File Processing

\`\`\`bash
# Process CSV file
while IFS=',' read -r hostname ip role; do
    echo "Host: $hostname | IP: $ip | Role: $role"
    # Do something with each host
    ping -c 1 -W 1 "$ip" > /dev/null 2>&1 && echo "$hostname: UP" || echo "$hostname: DOWN"
done < hosts.csv

# Find and process files
find /var/log -name "*.log" -mtime +30 -print0 | while IFS= read -r -d '' file; do
    gzip "$file"
    log "Compressed: $file"
done
\`\`\`

## Deployment Script Example

\`\`\`bash
#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/myapp"
BACKUP_DIR="/var/backups/myapp"
DEPLOY_USER="www-data"
GIT_REPO="https://github.com/company/myapp.git"
BRANCH="\${1:-main}"

log() { echo "[$(date +'%H:%M:%S')] $*"; }

log "Deploying branch: $BRANCH"

# Backup current version
if [[ -d "$APP_DIR" ]]; then
    log "Backing up current version..."
    tar -czf "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz" "$APP_DIR"
fi

# Pull new code
log "Fetching latest code..."
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Install dependencies
log "Installing dependencies..."
npm ci --production

# Run database migrations
log "Running migrations..."
npm run migrate

# Reload application (zero downtime)
log "Reloading application..."
systemctl reload nginx
pm2 reload myapp --update-env

log "Deployment complete!"
\`\`\`

## Cron Job Best Practices

\`\`\`bash
# Good cron entry: lock file prevents overlapping runs
cat > /etc/cron.d/health-check << 'EOF'
*/5 * * * * root flock -n /var/lock/health-check.lock /usr/local/bin/health-check.sh >> /var/log/health-check.log 2>&1
EOF

# Test the script before adding to cron
bash -n /usr/local/bin/health-check.sh  # Check syntax
bash -x /usr/local/bin/health-check.sh  # Debug trace
\`\`\``,
    contentFa: `## مقدمه

اسکریپت‌نویسی Bash کارهای تکراری مدیریت سیستم را خودکار می‌کند. این راهنما الگوهای عملی Bash مورد استفاده در محیط‌های تولیدی را پوشش می‌دهد.

## ساختار بهینه اسکریپت

\`\`\`bash
#!/bin/bash
set -euo pipefail

readonly LOG_FILE="/var/log/myscript.log"

cleanup() {
    rm -f /tmp/myscript_$$.*
}
trap cleanup EXIT

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}
\`\`\`

## توابع و مدیریت خطا

\`\`\`bash
check_disk_usage() {
    local mount_point="$1"
    local threshold="\${2:-85}"
    local usage=$(df "$mount_point" | awk 'NR==2 {print $5}' | tr -d '%')
    
    if [[ "$usage" -gt "$threshold" ]]; then
        log "WARNING: $mount_point is \${usage}% full"
        return 1
    fi
    return 0
}

if ! check_disk_usage /var 90; then
    echo "Disk alert" | mail -s "Disk Alert" admin@company.com
fi
\`\`\`

## اسکریپت بررسی سلامت سیستم

\`\`\`bash
#!/bin/bash
# بررسی بار CPU
cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | tr -d ' ')
if (( $(echo "$cpu_load > 4.0" | bc -l) )); then
    echo "High CPU: $cpu_load" | mail -s "CPU Alert" admin@company.com
fi

# بررسی دیسک
df -h | awk 'NR>1 {gsub(/%/,"",$5); if($5>85) print "ALERT: "$6" is "$5"% full"}'

# بررسی سرویس‌ها
for service in nginx mysql sshd; do
    systemctl is-active --quiet "$service" || echo "Service $service is DOWN!"
done
\`\`\`

## پردازش فایل

\`\`\`bash
while IFS=',' read -r hostname ip role; do
    ping -c 1 -W 1 "$ip" > /dev/null 2>&1 && echo "$hostname: UP" || echo "$hostname: DOWN"
done < hosts.csv
\`\`\``,
  },
  'lvm-raid-zfs-storage': {
    contentEn: `## Introduction

Storage management on Linux involves choosing between LVM (flexible volume management), RAID (redundancy), and ZFS (combined filesystem + volume manager with checksumming). This guide covers each approach with practical examples.

## LVM (Logical Volume Manager)

LVM adds a layer of abstraction between physical disks and filesystems, enabling resizing, snapshots, and spanning across multiple disks.

### LVM Components

\`\`\`
Physical Disks → PV (Physical Volume) → VG (Volume Group) → LV (Logical Volume) → Filesystem
\`\`\`

### Setting Up LVM

\`\`\`bash
# Create physical volumes
pvcreate /dev/sdb /dev/sdc /dev/sdd

# Create volume group
vgcreate data-vg /dev/sdb /dev/sdc /dev/sdd

# View volume group
vgdisplay data-vg

# Create logical volumes
lvcreate -L 100G -n web-data data-vg
lvcreate -L 50G -n db-data data-vg
lvcreate -l 100%FREE -n backup-data data-vg  # Use all remaining space

# Create filesystems
mkfs.ext4 /dev/data-vg/web-data
mkfs.xfs /dev/data-vg/db-data

# Mount
mount /dev/data-vg/web-data /var/www
\`\`\`

### Extending LVM

\`\`\`bash
# Add new disk
pvcreate /dev/sde
vgextend data-vg /dev/sde

# Extend logical volume
lvextend -L +50G /dev/data-vg/web-data

# Resize filesystem (ext4)
resize2fs /dev/data-vg/web-data

# XFS resize (can only grow, not shrink)
xfs_growfs /var/www

# One-liner extend + resize
lvextend -r -L +50G /dev/data-vg/web-data  # -r resizes filesystem automatically
\`\`\`

### LVM Snapshots

\`\`\`bash
# Create snapshot (requires space in VG for COW data)
lvcreate -L 10G -s -n web-data-snap /dev/data-vg/web-data

# Mount snapshot read-only
mount -o ro /dev/data-vg/web-data-snap /mnt/snapshot

# Take database backup from snapshot (no locks needed on live data)
mysqldump --all-databases > /backup/mysql-$(date +%Y%m%d).sql

# Remove snapshot when done
umount /mnt/snapshot
lvremove /dev/data-vg/web-data-snap
\`\`\`

## Linux Software RAID (mdadm)

RAID provides redundancy and/or performance. \`mdadm\` manages software RAID in Linux.

### RAID Levels

| Level | Disks | Redundancy | Read | Write |
|-------|-------|-----------|------|-------|
| RAID 0 | 2+ | None | Fast | Fast |
| RAID 1 | 2 | 1 disk failure | Fast | Same |
| RAID 5 | 3+ | 1 disk failure | Fast | Slower |
| RAID 6 | 4+ | 2 disk failures | Fast | Slowest |
| RAID 10 | 4+ | Multiple | Fast | Fast |

### Creating RAID Arrays

\`\`\`bash
# RAID 1 (mirror)
mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/sdb /dev/sdc

# RAID 5
mdadm --create /dev/md0 --level=5 --raid-devices=3 /dev/sdb /dev/sdc /dev/sdd

# RAID 10
mdadm --create /dev/md0 --level=10 --raid-devices=4 /dev/sdb /dev/sdc /dev/sdd /dev/sde

# Check rebuild progress
watch cat /proc/mdstat
\`\`\`

### RAID Maintenance

\`\`\`bash
# Check array status
mdadm --detail /dev/md0

# Save configuration
mdadm --detail --scan >> /etc/mdadm/mdadm.conf

# Mark disk as failed (simulate failure)
mdadm /dev/md0 --fail /dev/sdc

# Remove failed disk
mdadm /dev/md0 --remove /dev/sdc

# Add replacement disk
mdadm /dev/md0 --add /dev/sdf
# Watch rebuild
watch cat /proc/mdstat
\`\`\`

## ZFS

ZFS is the most sophisticated storage solution — it combines RAID, volume management, compression, deduplication, checksumming, and snapshots in one.

### Installing ZFS (Ubuntu)

\`\`\`bash
apt install zfsutils-linux
\`\`\`

### Creating ZFS Pools

\`\`\`bash
# Mirror (RAID 1 equivalent)
zpool create data-pool mirror /dev/sdb /dev/sdc

# RAID-Z1 (RAID 5 equivalent)
zpool create data-pool raidz /dev/sdb /dev/sdc /dev/sdd

# RAID-Z2 (RAID 6 equivalent)
zpool create data-pool raidz2 /dev/sdb /dev/sdc /dev/sdd /dev/sde

# Check status
zpool status data-pool
zpool list
\`\`\`

### ZFS Datasets and Features

\`\`\`bash
# Create datasets (like logical volumes)
zfs create data-pool/web
zfs create data-pool/database
zfs create data-pool/backups

# Enable compression (lz4 is fast, nearly free)
zfs set compression=lz4 data-pool

# Enable deduplication (expensive on RAM — needs 1GB RAM per 1TB data)
zfs set dedup=on data-pool/backups  # Only for backup data

# Set quotas and reservations
zfs set quota=100G data-pool/web
zfs set reservation=20G data-pool/database
\`\`\`

### ZFS Snapshots

\`\`\`bash
# Create snapshot
zfs snapshot data-pool/web@before-upgrade

# List snapshots
zfs list -t snapshot

# Rollback to snapshot
zfs rollback data-pool/web@before-upgrade

# Send snapshot to remote server (replication)
zfs send data-pool/web@daily | ssh backup-server "zfs receive backup-pool/web"

# Incremental send
zfs send -i data-pool/web@yesterday data-pool/web@today |   ssh backup-server "zfs receive backup-pool/web"
\`\`\`

### ZFS Scrub (Data Integrity Check)

\`\`\`bash
# Start scrub
zpool scrub data-pool

# Check scrub status
zpool status data-pool

# Schedule monthly scrub
echo "0 2 1 * * root /sbin/zpool scrub data-pool" >> /etc/cron.d/zfs-scrub
\`\`\``,
    contentFa: `## مقدمه

مدیریت ذخیره‌سازی در لینوکس شامل انتخاب بین LVM (مدیریت حجم انعطاف‌پذیر)، RAID (افزونگی) و ZFS (سیستم فایل + مدیریت حجم با Checksumming) است.

## LVM (مدیر حجم منطقی)

\`\`\`bash
# ایجاد volumes
pvcreate /dev/sdb /dev/sdc
vgcreate data-vg /dev/sdb /dev/sdc
lvcreate -L 100G -n web-data data-vg
mkfs.ext4 /dev/data-vg/web-data
mount /dev/data-vg/web-data /var/www

# گسترش
lvextend -r -L +50G /dev/data-vg/web-data
\`\`\`

## RAID با mdadm

\`\`\`bash
# RAID 1 (آینه)
mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/sdb /dev/sdc

# RAID 5
mdadm --create /dev/md0 --level=5 --raid-devices=3 /dev/sdb /dev/sdc /dev/sdd

watch cat /proc/mdstat
\`\`\`

## ZFS

\`\`\`bash
# ایجاد pool
zpool create data-pool mirror /dev/sdb /dev/sdc

# Dataset
zfs create data-pool/web

# فشرده‌سازی
zfs set compression=lz4 data-pool

# اسنپشات
zfs snapshot data-pool/web@before-upgrade
zfs rollback data-pool/web@before-upgrade

# ارسال به سرور راه دور
zfs send data-pool/web@daily | ssh backup-server "zfs receive backup-pool/web"
\`\`\``,
  },
  'postfix-mail-server-linux': {
    contentEn: `## Introduction

Postfix is the most widely deployed open-source MTA (Mail Transfer Agent) on Linux. It handles sending and receiving email with excellent security and performance. This guide covers setting up a complete production mail server with Postfix, Dovecot (for IMAP), and anti-spam measures.

## Architecture Overview

\`\`\`
Internet → [Postfix SMTP Port 25] → [SpamAssassin/ClamAV] → [Dovecot] → User IMAP/POP3
                                            |
                           [Postfix Submission Port 587] ← Outgoing mail from clients
\`\`\`

## Installation

\`\`\`bash
apt install postfix dovecot-core dovecot-imapd dovecot-pop3d
# During postfix install: choose "Internet Site", enter your domain
\`\`\`

## Postfix Main Configuration

Edit \`/etc/postfix/main.cf\`:

\`\`\`
# Basic settings
myhostname = mail.company.com
mydomain = company.com
myorigin = $mydomain
inet_interfaces = all
inet_protocols = all

# Who can receive email
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128

# Where to store mail
home_mailbox = Maildir/

# Size limits
message_size_limit = 52428800    # 50MB
mailbox_size_limit = 1073741824  # 1GB per mailbox

# TLS (required for modern email)
smtpd_tls_cert_file = /etc/ssl/certs/mail.company.com.crt
smtpd_tls_key_file = /etc/ssl/private/mail.company.com.key
smtpd_tls_security_level = may
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtp_tls_security_level = may

# SASL Authentication (for outgoing mail)
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes

# Restrictions
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination,
    reject_invalid_hostname,
    reject_unknown_recipient_domain

smtpd_helo_restrictions =
    permit_mynetworks,
    reject_invalid_helo_hostname,
    reject_non_fqdn_helo_hostname
\`\`\`

## Postfix Master (services) Configuration

Edit \`/etc/postfix/master.cf\` to enable submission port:

\`\`\`
# SMTP (receiving from internet)
smtp      inet  n       -       y       -       -       smtpd

# Submission port 587 (for authenticated clients sending outgoing mail)
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING

# SMTPS port 465 (legacy but still used)
smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
\`\`\`

## Dovecot IMAP/POP3 Configuration

Edit \`/etc/dovecot/dovecot.conf\`:

\`\`\`
protocols = imap pop3 lmtp

ssl = required
ssl_cert = </etc/ssl/certs/mail.company.com.crt
ssl_key = </etc/ssl/private/mail.company.com.key
ssl_min_protocol = TLSv1.2

# Authentication
auth_mechanisms = plain login

# Where emails are stored
mail_location = maildir:~/Maildir

# LMTP socket for Postfix delivery
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

# Auth socket for Postfix SASL
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0666
    user = postfix
    group = postfix
  }
}
\`\`\`

## Anti-Spam with SpamAssassin

\`\`\`bash
apt install spamassassin spamc

# Enable SpamAssassin
systemctl enable spamassassin
systemctl start spamassassin

# Update rules
sa-update

# Add to postfix main.cf
smtpd_milters = unix:/var/spool/postfix/spamass/spamass.sock
milter_default_action = accept
\`\`\`

## DNS Records Required

\`\`\`
# MX record
@ IN MX 10 mail.company.com.

# A record for mail server
mail IN A 203.0.113.10

# SPF
@ IN TXT "v=spf1 mx -all"

# Reverse DNS (PTR) - set via your ISP/datacenter
10.113.0.203.in-addr.arpa IN PTR mail.company.com.
\`\`\`

## Testing

\`\`\`bash
# Test SMTP connection
telnet mail.company.com 25
# Should see: 220 mail.company.com ESMTP Postfix

# Send test email
echo "Test body" | mail -s "Test Subject" test@example.com

# Check mail queue
postqueue -p

# View mail logs
tail -f /var/log/mail.log

# Test TLS
openssl s_client -starttls smtp -connect mail.company.com:587

# Test authentication
echo -ne ' username password' | base64
# Then in telnet: AUTH PLAIN <base64_string>
\`\`\`

## Mail Queue Management

\`\`\`bash
# View queue
postqueue -p

# Flush queue (attempt delivery now)
postqueue -f

# Delete specific message
postsuper -d MSG_ID

# Delete all deferred messages
postsuper -d ALL deferred

# Hold/release messages
postsuper -h MSG_ID
postsuper -H MSG_ID
\`\`\``,
    contentFa: `## مقدمه

Postfix محبوب‌ترین MTA (عامل انتقال ایمیل) متن‌باز در لینوکس است. این راهنما راه‌اندازی یک سرور ایمیل تولیدی کامل را پوشش می‌دهد.

## نصب

\`\`\`bash
apt install postfix dovecot-core dovecot-imapd
\`\`\`

## پیکربندی اصلی Postfix

\`\`\`
myhostname = mail.company.com
mydomain = company.com
mydestination = $myhostname, localhost, $mydomain
home_mailbox = Maildir/
message_size_limit = 52428800

# TLS
smtpd_tls_cert_file = /etc/ssl/certs/mail.company.com.crt
smtpd_tls_key_file = /etc/ssl/private/mail.company.com.key
smtpd_tls_security_level = may

# محدودیت‌ها
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination
\`\`\`

## رکوردهای DNS مورد نیاز

\`\`\`
@ IN MX 10 mail.company.com.
mail IN A 203.0.113.10
@ IN TXT "v=spf1 mx -all"
\`\`\`

## آزمایش

\`\`\`bash
echo "Test body" | mail -s "Test" test@example.com
postqueue -p
tail -f /var/log/mail.log
\`\`\`

## مدیریت صف ایمیل

\`\`\`bash
postqueue -p      # مشاهده صف
postqueue -f      # تحویل فوری
postsuper -d ALL deferred  # حذف همه پیام‌های معوق
\`\`\``,
  },
  'linux-bonding-vlan-bridges': {
    contentEn: `## Introduction

Linux has powerful networking capabilities built into the kernel — bonding (NIC teaming), VLANs, and bridges allow you to build complex network topologies without any additional hardware. These are essential for hypervisors, routers-on-a-stick, and high-availability servers.

## Linux Bonding (NIC Teaming)

Bonding combines multiple physical NICs into a single logical interface for redundancy or throughput.

### Bonding Modes

| Mode | Name | Use Case |
|------|------|----------|
| 0 | round-robin | Max throughput, no redundancy |
| 1 | active-backup | High availability, one active NIC |
| 2 | balance-xor | Load balance by XOR of MAC |
| 4 | 802.3ad (LACP) | True link aggregation, needs switch support |
| 5 | balance-tlb | Adaptive load balancing, no switch config |
| 6 | balance-alb | ALB + receive load balancing |

### Setting Up Bonding (systemd-networkd)

Create \`/etc/systemd/network/bond0.netdev\`:
\`\`\`ini
[NetDev]
Name=bond0
Kind=bond

[Bond]
Mode=active-backup
MIIMonitorSec=100ms
FailOverMACPolicy=active
\`\`\`

Create \`/etc/systemd/network/bond0.network\`:
\`\`\`ini
[Match]
Name=bond0

[Network]
Address=192.168.1.10/24
Gateway=192.168.1.1
DNS=8.8.8.8
\`\`\`

Create member interfaces \`/etc/systemd/network/eth0.network\`:
\`\`\`ini
[Match]
Name=eth0

[Network]
Bond=bond0
\`\`\`

Similarly for eth1. Then:
\`\`\`bash
systemctl restart systemd-networkd
\`\`\`

### Setting Up Bonding (legacy ifconfig/ip method)

\`\`\`bash
# Load bonding module
modprobe bonding

# Create bond interface
ip link add bond0 type bond mode active-backup miimon 100

# Add slaves
ip link set eth0 master bond0
ip link set eth1 master bond0

# Bring up the bond
ip link set bond0 up
ip addr add 192.168.1.10/24 dev bond0

# Check bond status
cat /proc/net/bonding/bond0
\`\`\`

### LACP (802.3ad) Setup

Requires switch configuration (portchannel/LAG):

\`\`\`bash
# Server side
ip link add bond0 type bond mode 802.3ad lacp_rate fast miimon 100
ip link set eth0 master bond0
ip link set eth1 master bond0

# Switch side (Cisco IOS example)
interface range GigabitEthernet0/1-2
 channel-group 1 mode active  # LACP active
 channel-protocol lacp
interface Port-channel1
 no shutdown
\`\`\`

## Linux VLANs

VLANs segment network traffic on a single physical interface.

\`\`\`bash
# Load VLAN module
modprobe 8021q

# Create VLAN interface
ip link add link eth0 name eth0.10 type vlan id 10
ip link add link eth0 name eth0.20 type vlan id 20

# Assign IPs
ip link set eth0.10 up
ip link set eth0.20 up
ip addr add 192.168.10.1/24 dev eth0.10
ip addr add 192.168.20.1/24 dev eth0.20
\`\`\`

### Persistent VLAN with systemd-networkd

\`\`\`ini
# /etc/systemd/network/vlan10.netdev
[NetDev]
Name=vlan10
Kind=vlan

[VLAN]
Id=10
\`\`\`

\`\`\`ini
# /etc/systemd/network/vlan10.network
[Match]
Name=vlan10

[Network]
Address=192.168.10.1/24
\`\`\`

## Linux Bridges

A bridge acts as a virtual switch, connecting multiple interfaces at Layer 2.

\`\`\`bash
# Create bridge
ip link add br0 type bridge

# Add interfaces to bridge
ip link set eth0 master br0
ip link set eth1 master br0

# Assign IP to bridge (not to individual interfaces)
ip link set br0 up
ip addr add 192.168.1.10/24 dev br0

# Enable STP on bridge
ip link set br0 type bridge stp_state 1
\`\`\`

## Complete Hypervisor Network Stack

Typical KVM/libvirt setup with bonding + VLANs + bridges:

\`\`\`
Physical NICs: eth0, eth1
   → bond0 (LACP/active-backup)
      → vlan10 (management)
         → br-mgmt (bridge for VMs using management VLAN)
      → vlan20 (production)
         → br-prod (bridge for production VMs)
      → vlan30 (storage)
         → br-storage (bridge for storage traffic)
\`\`\`

\`\`\`bash
# Full setup
ip link add bond0 type bond mode active-backup miimon 100
ip link set eth0 master bond0
ip link set eth1 master bond0
ip link set bond0 up

ip link add link bond0 name bond0.10 type vlan id 10
ip link add link bond0 name bond0.20 type vlan id 20

ip link add br-mgmt type bridge
ip link set bond0.10 master br-mgmt
ip addr add 10.0.10.1/24 dev br-mgmt
ip link set br-mgmt up

ip link add br-prod type bridge
ip link set bond0.20 master br-prod
ip link set br-prod up
\`\`\`

## Persistent Configuration with Netplan (Ubuntu)

\`\`\`yaml
# /etc/netplan/01-network.yaml
network:
  version: 2
  bonds:
    bond0:
      interfaces: [eth0, eth1]
      parameters:
        mode: active-backup
        mii-monitor-interval: 100
  vlans:
    bond0.10:
      id: 10
      link: bond0
    bond0.20:
      id: 20
      link: bond0
  bridges:
    br-mgmt:
      interfaces: [bond0.10]
      addresses: [10.0.10.1/24]
    br-prod:
      interfaces: [bond0.20]
\`\`\`

\`\`\`bash
netplan apply
\`\`\``,
    contentFa: `## مقدمه

لینوکس قابلیت‌های شبکه‌ای قدرتمندی دارد — bonding، VLAN و bridge به شما اجازه می‌دهند توپولوژی‌های پیچیده شبکه را بدون سخت‌افزار اضافی بسازید.

## Bonding لینوکس

\`\`\`bash
ip link add bond0 type bond mode active-backup miimon 100
ip link set eth0 master bond0
ip link set eth1 master bond0
ip link set bond0 up
ip addr add 192.168.1.10/24 dev bond0

cat /proc/net/bonding/bond0
\`\`\`

## VLAN‌های لینوکس

\`\`\`bash
modprobe 8021q
ip link add link eth0 name eth0.10 type vlan id 10
ip link add link eth0 name eth0.20 type vlan id 20
ip link set eth0.10 up
ip addr add 192.168.10.1/24 dev eth0.10
\`\`\`

## Bridge لینوکس

\`\`\`bash
ip link add br0 type bridge
ip link set eth0 master br0
ip link set eth1 master br0
ip link set br0 up
ip addr add 192.168.1.10/24 dev br0
\`\`\`

## پیکربندی با Netplan (Ubuntu)

\`\`\`yaml
network:
  version: 2
  bonds:
    bond0:
      interfaces: [eth0, eth1]
      parameters:
        mode: active-backup
  vlans:
    bond0.10:
      id: 10
      link: bond0
  bridges:
    br-mgmt:
      interfaces: [bond0.10]
      addresses: [10.0.10.1/24]
\`\`\`

\`\`\`bash
netplan apply
\`\`\``,
  },
  'prometheus-node-exporter': {
    contentEn: `## Introduction

Prometheus is a pull-based monitoring system that scrapes metrics from targets at defined intervals. Node Exporter exposes Linux system metrics (CPU, memory, disk, network) in Prometheus format. Together they form the foundation of modern infrastructure monitoring.

## Architecture

\`\`\`
[Linux Servers] 
   └── [Node Exporter :9100] ← Prometheus scrapes every 15s
   
[Applications]
   └── [Custom Metrics :8080/metrics]
   
[Prometheus :9090] ← Stores time series data
   └── [Grafana :3000] ← Visualizes data
   └── [Alertmanager :9093] ← Sends alerts
\`\`\`

## Installing Node Exporter

\`\`\`bash
# Download latest release
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xzf node_exporter-1.7.0.linux-amd64.tar.gz
cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/

# Create system user
useradd --no-create-home --shell /bin/false node_exporter

# Create systemd service
cat > /etc/systemd/system/node_exporter.service << EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter \
  --collector.filesystem.mount-points-exclude="^/(sys|proc|dev|run)($|/)" \
  --collector.systemd \
  --collector.processes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable node_exporter
systemctl start node_exporter

# Verify
curl -s http://localhost:9100/metrics | head -30
\`\`\`

## Installing Prometheus

\`\`\`bash
# Create user
useradd --no-create-home --shell /bin/false prometheus

# Create directories
mkdir -p /etc/prometheus /var/lib/prometheus

# Download
wget https://github.com/prometheus/prometheus/releases/download/v2.49.0/prometheus-2.49.0.linux-amd64.tar.gz
tar xzf prometheus-2.49.0.linux-amd64.tar.gz
cp prometheus-2.49.0.linux-amd64/prometheus /usr/local/bin/
cp prometheus-2.49.0.linux-amd64/promtool /usr/local/bin/

chown prometheus:prometheus /etc/prometheus /var/lib/prometheus
\`\`\`

## Prometheus Configuration

Create \`/etc/prometheus/prometheus.yml\`:

\`\`\`yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - "/etc/prometheus/rules/*.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets:
          - 'web-server-1:9100'
          - 'web-server-2:9100'
          - 'db-server-1:9100'
        labels:
          env: production
    
  - job_name: 'node-dev'
    static_configs:
      - targets: ['dev-server-1:9100']
        labels:
          env: development
\`\`\`

\`\`\`bash
# Create systemd service
cat > /etc/systemd/system/prometheus.service << EOF
[Unit]
Description=Prometheus
After=network.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus \
  --storage.tsdb.retention.time=30d \
  --web.listen-address=:9090

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable prometheus
systemctl start prometheus
\`\`\`

## Alert Rules

Create \`/etc/prometheus/rules/infrastructure.yml\`:

\`\`\`yaml
groups:
  - name: infrastructure
    rules:
      - alert: HighCPULoad
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU on {{ $labels.instance }}"
          description: "CPU usage is {{ $value | printf '%.2f' }}%"

      - alert: LowDiskSpace
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 15
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk on {{ $labels.instance }}"
          description: "Only {{ $value | printf '%.2f' }}% disk space remaining"

      - alert: HostDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Host {{ $labels.instance }} is down"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory on {{ $labels.instance }}: {{ $value | printf '%.2f' }}%"
\`\`\`

## Useful PromQL Queries

\`\`\`promql
# CPU usage per host (percentage)
100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage percentage
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disk usage percentage
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# Network in/out (bytes per second)
irate(node_network_receive_bytes_total{device="eth0"}[5m])
irate(node_network_transmit_bytes_total{device="eth0"}[5m])

# Disk I/O
irate(node_disk_read_bytes_total{device="sda"}[5m])
irate(node_disk_written_bytes_total{device="sda"}[5m])

# Load average vs CPU count
node_load1 / count by(instance) (node_cpu_seconds_total{mode="idle"})
\`\`\`

## Service Discovery (for Dynamic Environments)

Instead of static targets, use file-based service discovery:

\`\`\`yaml
# prometheus.yml
- job_name: 'dynamic-nodes'
  file_sd_configs:
    - files: ['/etc/prometheus/targets/*.json']
      refresh_interval: 30s
\`\`\`

Create target files dynamically:

\`\`\`bash
cat > /etc/prometheus/targets/web-servers.json << EOF
[
  {
    "targets": ["web-1:9100", "web-2:9100", "web-3:9100"],
    "labels": {"env": "production", "role": "webserver"}
  }
]
EOF
\`\`\``,
    contentFa: `## مقدمه

Prometheus یک سیستم پایش pull-based است که معیارها را از اهداف در فواصل تعریف‌شده جمع‌آوری می‌کند. Node Exporter معیارهای سیستم لینوکس را در قالب Prometheus نمایش می‌دهد.

## نصب Node Exporter

\`\`\`bash
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xzf node_exporter-1.7.0.linux-amd64.tar.gz
cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/

systemctl enable node_exporter
systemctl start node_exporter
curl -s http://localhost:9100/metrics | head -30
\`\`\`

## پیکربندی Prometheus

\`\`\`yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets:
          - 'web-server-1:9100'
          - 'db-server-1:9100'
\`\`\`

## قوانین هشدار

\`\`\`yaml
groups:
  - name: infrastructure
    rules:
      - alert: HighCPULoad
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 5m
        labels:
          severity: warning

      - alert: LowDiskSpace
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 15
        for: 5m
        labels:
          severity: critical

      - alert: HostDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
\`\`\`

## جست‌وجوهای PromQL مفید

\`\`\`promql
# استفاده CPU
100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# استفاده حافظه
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# استفاده دیسک
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100
\`\`\``,
  },
  'keepalived-haproxy-ha': {
    contentEn: `## Introduction

High availability for services requires both load balancing (HAProxy) and failover for the load balancer itself (Keepalived with VRRP). Together they create a fully redundant setup where a floating IP automatically moves to a standby server if the primary fails.

## Architecture

\`\`\`
Clients → [Virtual IP: 10.0.0.100]
               |
    ┌──────────┴──────────┐
[HAProxy-1 (Master)]  [HAProxy-2 (Backup)]
  10.0.0.10              10.0.0.11
    |                      |
    └──────────┬───────────┘
               |
    ┌──────────┼──────────┐
[Web-1:80]  [Web-2:80]  [Web-3:80]
\`\`\`

## Installing HAProxy

\`\`\`bash
apt install haproxy
\`\`\`

Edit \`/etc/haproxy/haproxy.cfg\`:

\`\`\`
global
    log /dev/log local0
    log /dev/log local1 notice
    maxconn 50000
    user haproxy
    group haproxy
    daemon
    stats socket /run/haproxy/admin.sock mode 660 level admin expose-fd listeners

defaults
    log global
    mode http
    option httplog
    option dontlognull
    option forwardfor
    option http-server-close
    retries 3
    timeout connect 5s
    timeout client 30s
    timeout server 30s

# Statistics page
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 10s
    stats auth admin:yourpassword

# Frontend: what HAProxy listens on
frontend web-frontend
    bind *:80
    bind *:443 ssl crt /etc/haproxy/certs/combined.pem
    
    # Redirect HTTP to HTTPS
    redirect scheme https if !{ ssl_fc }
    
    # Route by path
    acl is_api path_beg /api/
    use_backend api-servers if is_api
    default_backend web-servers

# Backend: the actual servers
backend web-servers
    balance roundrobin
    option httpchk GET /health HTTP/1.1
Host:\ localhost
    http-check expect status 200
    server web-1 10.0.1.10:80 check inter 2s rise 2 fall 3
    server web-2 10.0.1.11:80 check inter 2s rise 2 fall 3
    server web-3 10.0.1.12:80 check inter 2s rise 2 fall 3 backup

backend api-servers
    balance leastconn
    option httpchk GET /api/health
    server api-1 10.0.2.10:8080 check
    server api-2 10.0.2.11:8080 check
\`\`\`

## Installing Keepalived (VRRP Failover)

\`\`\`bash
apt install keepalived
\`\`\`

### Master Configuration (10.0.0.10)

Create \`/etc/keepalived/keepalived.conf\`:

\`\`\`
vrrp_script check_haproxy {
    script "killall -0 haproxy"   # Check if haproxy is running
    interval 2
    weight -20                     # Reduce priority by 20 if check fails
    fall 2
    rise 2
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51           # Same on both nodes
    priority 100                   # Higher = preferred master
    advert_int 1                   # Send VRRP advertisements every 1 second
    authentication {
        auth_type PASS
        auth_pass YourSecretPass123
    }
    virtual_ipaddress {
        10.0.0.100/24 dev eth0    # The floating IP
    }
    track_script {
        check_haproxy
    }
    notify_master "/etc/keepalived/notify.sh MASTER"
    notify_backup "/etc/keepalived/notify.sh BACKUP"
    notify_fault "/etc/keepalived/notify.sh FAULT"
}
\`\`\`

### Backup Configuration (10.0.0.11)

Same file but change:
\`\`\`
state BACKUP
priority 90  # Lower than master
\`\`\`

### Notification Script

\`\`\`bash
cat > /etc/keepalived/notify.sh << 'EOF'
#!/bin/bash
TYPE=$1
DATE=$(date +'%Y-%m-%d %H:%M:%S')
echo "$DATE - Keepalived state: $TYPE" >> /var/log/keepalived-state.log
echo "HAProxy node $(hostname) became $TYPE at $DATE" |   mail -s "HAProxy Failover: $TYPE" admin@company.com
EOF
chmod +x /etc/keepalived/notify.sh
\`\`\`

## Starting Services

\`\`\`bash
# On both nodes
systemctl enable haproxy keepalived
systemctl start haproxy keepalived

# Check VIP assignment (only on master)
ip addr show eth0 | grep 10.0.0.100

# View keepalived logs
journalctl -u keepalived -f
\`\`\`

## Testing Failover

\`\`\`bash
# Continuous test from client
while true; do curl -s http://10.0.0.100/ | grep "server-name"; sleep 1; done

# On master: stop haproxy
systemctl stop haproxy
# VIP should move to backup within 2-4 seconds

# Or disconnect network on master
ip link set eth0 down
# VIP moves to backup immediately
\`\`\`

## HAProxy Health Check Examples

\`\`\`
# HTTP health check
option httpchk GET /health
http-check expect status 200

# TCP health check (for databases)
option tcp-check

# Custom health check script
external-check command /usr/lib/nagios/plugins/check_mysql

# Health check with specific host header
option httpchk GET /health HTTP/1.1
Host:\ api.company.com
\`\`\`

## SSL Termination at HAProxy

\`\`\`bash
# Combine certificate and key
cat /etc/ssl/certs/example.com.crt /etc/ssl/private/example.com.key > /etc/haproxy/certs/combined.pem
chmod 600 /etc/haproxy/certs/combined.pem

# Enable in HAProxy frontend
bind *:443 ssl crt /etc/haproxy/certs/combined.pem alpn h2,http/1.1
ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets
\`\`\``,
    contentFa: `## مقدمه

دسترسی بالا برای سرویس‌ها نیاز به load balancing (HAProxy) و failover برای خود load balancer (Keepalived با VRRP) دارد.

## معماری

\`\`\`
کلاینت‌ها → [IP مجازی: 10.0.0.100]
                  |
    [HAProxy-1 (Master)]  [HAProxy-2 (Backup)]
         |                      |
    [Web-1:80]  [Web-2:80]  [Web-3:80]
\`\`\`

## پیکربندی HAProxy

\`\`\`
frontend web-frontend
    bind *:80
    bind *:443 ssl crt /etc/haproxy/certs/combined.pem
    redirect scheme https if !{ ssl_fc }
    default_backend web-servers

backend web-servers
    balance roundrobin
    option httpchk GET /health HTTP/1.1
Host:\ localhost
    server web-1 10.0.1.10:80 check inter 2s rise 2 fall 3
    server web-2 10.0.1.11:80 check inter 2s rise 2 fall 3
\`\`\`

## پیکربندی Keepalived

**Master (10.0.0.10):**
\`\`\`
vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass YourSecretPass123
    }
    virtual_ipaddress {
        10.0.0.100/24 dev eth0
    }
}
\`\`\`

## آزمایش Failover

\`\`\`bash
while true; do curl -s http://10.0.0.100/ | grep "server"; sleep 1; done
systemctl stop haproxy  # روی master
# IP مجازی باید ظرف ۲-۴ ثانیه به backup منتقل شود
\`\`\``,
  },
  'elk-log-management-linux': {
    contentEn: `## Introduction

Centralized log management is critical for troubleshooting, security auditing, and compliance. The ELK Stack (Elasticsearch, Logstash, Kibana) combined with Filebeat/Metricbeat provides a complete log management solution for Linux infrastructure.

## Why Centralized Logging?

- Logs disappear when a server fails — centralized storage survives failures
- Grep across 50 servers simultaneously
- Correlate events across systems (web request → app log → DB log)
- Meet audit and compliance requirements (PCI-DSS, ISO 27001)
- Detect security incidents by correlating multiple log sources

## Log Sources to Collect

| Source | File/Method | Priority |
|--------|------------|---------|
| Auth/SSH | /var/log/auth.log | Critical |
| Syslog | /var/log/syslog | High |
| Nginx/Apache | /var/log/nginx/*.log | High |
| Application | /var/log/myapp/*.log | High |
| Kernel | /var/log/kern.log | Medium |
| Cron | /var/log/cron.log | Low |

## Filebeat Configuration (on each Linux server)

Install Filebeat:

\`\`\`bash
apt install filebeat
\`\`\`

Configure \`/etc/filebeat/filebeat.yml\`:

\`\`\`yaml
filebeat.inputs:

- type: log
  enabled: true
  paths:
    - /var/log/auth.log
  fields:
    log_type: auth
    environment: production
    hostname: \${HOSTNAME}

- type: log
  enabled: true
  paths:
    - /var/log/syslog
  fields:
    log_type: syslog

- type: log
  enabled: true
  paths:
    - /var/log/nginx/access.log
  fields:
    log_type: nginx_access
  json.keys_under_root: true
  json.add_error_key: true

- type: log
  enabled: true
  paths:
    - /var/log/nginx/error.log
  fields:
    log_type: nginx_error

# Multiline for Java stack traces
- type: log
  enabled: true
  paths:
    - /var/log/myapp/*.log
  fields:
    log_type: application
  multiline:
    pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    negate: true
    match: after

output.logstash:
  hosts: ["logstash-server:5044"]
  ssl.certificate_authorities: ["/etc/filebeat/certs/ca.crt"]
  ssl.certificate: "/etc/filebeat/certs/filebeat.crt"
  ssl.key: "/etc/filebeat/certs/filebeat.key"

processors:
  - add_host_metadata:
      when.not.contains.tags: forwarded
  - add_cloud_metadata: ~
  - drop_fields:
      fields: ["agent.ephemeral_id"]
\`\`\`

## Logstash Parsing Pipelines

Create \`/etc/logstash/conf.d/auth.conf\`:

\`\`\`ruby
filter {
  if [fields][log_type] == "auth" {
    grok {
      match => {
        "message" => [
          # SSH failed login
          "%{SYSLOGTIMESTAMP:timestamp} %{SYSLOGHOST:host} sshd\[%{POSINT:pid}\]: Failed password for %{USER:failed_user} from %{IP:src_ip} port %{INT:src_port}",
          # SSH successful login
          "%{SYSLOGTIMESTAMP:timestamp} %{SYSLOGHOST:host} sshd\[%{POSINT:pid}\]: Accepted publickey for %{USER:auth_user} from %{IP:src_ip}",
          # sudo
          "%{SYSLOGTIMESTAMP:timestamp} %{SYSLOGHOST:host} sudo:\s+%{USER:sudo_user} : TTY=%{DATA:tty} ; PWD=%{PATH:pwd} ; USER=%{USER:run_as_user} ; COMMAND=%{GREEDYDATA:command}"
        ]
      }
    }
    
    # GeoIP lookup for source IP
    if [src_ip] {
      geoip {
        source => "src_ip"
        target => "geoip"
      }
    }
    
    date {
      match => ["timestamp", "MMM  d HH:mm:ss", "MMM dd HH:mm:ss"]
      target => "@timestamp"
    }
  }
}
\`\`\`

Create \`/etc/logstash/conf.d/nginx.conf\`:

\`\`\`ruby
filter {
  if [fields][log_type] == "nginx_access" {
    grok {
      match => {
        "message" => '%{IPORHOST:client_ip} - %{DATA:user} \[%{HTTPDATE:timestamp}\] "%{WORD:method} %{DATA:request_uri} HTTP/%{NUMBER:http_version}" %{INT:status_code} %{INT:bytes} "%{DATA:referrer}" "%{DATA:user_agent}"'
      }
    }
    
    mutate {
      convert => {
        "status_code" => "integer"
        "bytes" => "integer"
      }
    }
    
    geoip {
      source => "client_ip"
    }
    
    useragent {
      source => "user_agent"
      target => "ua"
    }
  }
}
\`\`\`

## Security Dashboards in Kibana

Key visualizations to build:

\`\`\`
1. SSH Failed Logins Map
   - World map showing src_ip GeoIP locations for failed SSH
   - Filter: log_type:auth AND message:"Failed password"

2. HTTP Error Rate
   - Line chart of 4xx/5xx over time
   - Filter: log_type:nginx_access AND status_code >= 400

3. Top Attackers
   - Data table: top src_ip by count for failed SSH
   - Alert if single IP fails 10+ times in 5 minutes

4. Successful Sudo Commands
   - Who ran what as root
   - Filter: log_type:auth AND message:"sudo"
\`\`\`

## Log Retention with ILM

Configure Index Lifecycle Management:

\`\`\`bash
# Hot: 0-7 days (active writing)
# Warm: 7-30 days (read only, compressed)
# Delete: after 90 days

curl -X PUT "localhost:9200/_ilm/policy/logs-policy" -H 'Content-Type: application/json' -d'
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {"max_age": "1d", "max_size": "50gb"},
          "set_priority": {"priority": 100}
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "allocate": {"number_of_replicas": 0},
          "shrink": {"number_of_shards": 1},
          "forcemerge": {"max_num_segments": 1},
          "set_priority": {"priority": 50}
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {"delete": {}}
      }
    }
  }
}'
\`\`\``,
    contentFa: `## مقدمه

مدیریت لاگ متمرکز برای رفع مشکل، ممیزی امنیتی و انطباق ضروری است. ELK Stack یک راه‌حل کامل برای مدیریت لاگ زیرساخت لینوکس فراهم می‌کند.

## پیکربندی Filebeat

\`\`\`yaml
filebeat.inputs:
- type: log
  paths:
    - /var/log/auth.log
  fields:
    log_type: auth
    environment: production

- type: log
  paths:
    - /var/log/nginx/access.log
  fields:
    log_type: nginx_access

output.logstash:
  hosts: ["logstash-server:5044"]
\`\`\`

## Pipeline Logstash برای SSH

\`\`\`ruby
filter {
  if [fields][log_type] == "auth" {
    grok {
      match => {
        "message" => "%{SYSLOGTIMESTAMP:timestamp} %{SYSLOGHOST:host} sshd\[%{POSINT:pid}\]: Failed password for %{USER:failed_user} from %{IP:src_ip}"
      }
    }
    if [src_ip] {
      geoip { source => "src_ip" }
    }
  }
}
\`\`\`

## داشبوردهای امنیتی در Kibana

۱. نقشه لاگین‌های ناموفق SSH (GeoIP)
۲. نرخ خطاهای HTTP (4xx/5xx)
۳. جدول فرمان‌های sudo
۴. بالاترین مهاجمان بر اساس IP`,
  },
  'cisco-stp-rstp-mstp': {
    contentEn: `## Introduction

Spanning Tree Protocol prevents Layer 2 loops in switched networks. STP (802.1D), RSTP (802.1w), and MSTP (802.1s) are three generations of the same core idea. Modern networks use RSTP or MSTP — STP is too slow (30-50 second convergence) for production.

## Why Loops Are Dangerous

Without STP, a Layer 2 loop causes a **broadcast storm**: frames circulate endlessly, consuming all bandwidth and crashing switches within seconds. STP blocks redundant paths while keeping them available for failover.

## STP Port States

| State | Forwards data? | Duration |
|-------|----------------|---------|
| Blocking | No | Until topology change |
| Listening | No | 15 seconds |
| Learning | No (learns MACs) | 15 seconds |
| Forwarding | Yes | Normal operation |
| Disabled | No | Manually disabled |

RSTP reduces this to: Discarding, Learning, Forwarding — with convergence in 1-2 seconds.

## Basic STP/RSTP on Cisco

\`\`\`cisco
! Enable RSTP (Rapid Spanning Tree)
spanning-tree mode rapid-pvst

! Set root bridge for VLAN 10
spanning-tree vlan 10 priority 4096
! Or use macro:
spanning-tree vlan 10 root primary

! Set secondary root
spanning-tree vlan 10 root secondary

! Check STP status
show spanning-tree vlan 10
show spanning-tree summary
\`\`\`

## Understanding Port Roles and States

\`\`\`cisco
show spanning-tree vlan 10

! Output shows:
! Root ID  Priority    4096
!          Address     aabb.cc00.0100
!          Cost        4
!          Port        Gi0/1 (Root Port)
!
! Bridge ID Priority    32778
!
! Interface   Role  Sts  Cost    Prio.Nbr Type
! Gi0/0       Desg  FWD  4       128.1    P2p
! Gi0/1       Root  FWD  4       128.2    P2p  ← connected to root
! Gi0/2       Altn  BLK  4       128.3    P2p  ← blocked redundant path
\`\`\`

## STP Tuning for Faster Convergence

\`\`\`cisco
! PortFast: Skip listening/learning on access ports (for servers/PCs)
interface GigabitEthernet0/1
 spanning-tree portfast

! Or enable globally for all access ports
spanning-tree portfast default

! BPDU Guard: Shutdown port if BPDU received on portfast port
interface GigabitEthernet0/1
 spanning-tree bpduguard enable

! Or globally
spanning-tree portfast bpduguard default

! BPDU Filter: Don't send/receive BPDUs (use carefully!)
interface GigabitEthernet0/1
 spanning-tree bpdufilter enable
\`\`\`

## Root Guard and Loop Guard

\`\`\`cisco
! Root Guard: Prevent inferior switch from becoming root
! Apply on ports facing access layer
interface GigabitEthernet0/1
 spanning-tree guard root

! Loop Guard: Detect unidirectional links (one-way fiber failure)
! Apply on non-designated ports
interface GigabitEthernet0/2
 spanning-tree guard loop

! Enable globally
spanning-tree loopguard default
\`\`\`

## MSTP (Multiple Spanning Tree)

MSTP allows multiple STP instances, each controlling multiple VLANs. This enables load balancing across redundant links.

\`\`\`cisco
! Configure MSTP
spanning-tree mode mst

spanning-tree mst configuration
 name CompanyNet
 revision 1
 instance 1 vlan 1-100    ! Instance 1 handles VLANs 1-100
 instance 2 vlan 101-200  ! Instance 2 handles VLANs 101-200
 exit

! Set root for each instance on different switches
! Switch A: Root for Instance 1
spanning-tree mst 1 priority 4096

! Switch B: Root for Instance 2
spanning-tree mst 2 priority 4096

! Result: Switch A forwards VLANs 1-100, Switch B forwards VLANs 101-200
! Both redundant links are ACTIVE, just for different VLANs!
\`\`\`

## Troubleshooting STP Issues

\`\`\`cisco
! Find current root bridge
show spanning-tree vlan 10 | include Root ID

! Find topology change history
show spanning-tree detail | include topology

! Monitor STP events
debug spanning-tree events

! Clear topology change counters
clear spanning-tree counters interface GigabitEthernet0/1

! Check BPDU counters
show spanning-tree interface GigabitEthernet0/1 detail
\`\`\`

## Common STP Problems and Fixes

**Problem**: Slow convergence after a link failure
- Fix: Enable PortFast on access ports, verify RSTP is enabled

**Problem**: Unexpected root bridge election
- Fix: Set explicit priorities on all switches, enable Root Guard on uplinks

**Problem**: Intermittent connectivity (STP reconverging frequently)
- Check for unidirectional links using Loop Guard
- Look for TCN (Topology Change Notification) storm: \`show spanning-tree detail | include TCN\`

**Problem**: Station can't communicate despite connected
- Check if port is in BLK state: \`show spanning-tree vlan X\`
- Verify BPDU Guard hasn't err-disabled the port: \`show interfaces status err-disabled\``,
    contentFa: `## مقدمه

Spanning Tree Protocol از حلقه‌های لایه ۲ در شبکه‌های سوئیچ جلوگیری می‌کند. شبکه‌های مدرن از RSTP یا MSTP استفاده می‌کنند.

## پیکربندی پایه STP/RSTP

\`\`\`cisco
! فعال‌سازی RSTP
spanning-tree mode rapid-pvst

! تنظیم Root Bridge برای VLAN 10
spanning-tree vlan 10 priority 4096

! بررسی وضعیت STP
show spanning-tree vlan 10
show spanning-tree summary
\`\`\`

## تنظیم STP برای همگرایی سریع‌تر

\`\`\`cisco
! PortFast برای پورت‌های دسترسی
interface GigabitEthernet0/1
 spanning-tree portfast
 spanning-tree bpduguard enable

! فعال‌سازی سراسری
spanning-tree portfast default
spanning-tree portfast bpduguard default
\`\`\`

## MSTP (Multiple Spanning Tree)

\`\`\`cisco
spanning-tree mode mst

spanning-tree mst configuration
 name CompanyNet
 revision 1
 instance 1 vlan 1-100
 instance 2 vlan 101-200

! Root برای هر instance روی switch مختلف
spanning-tree mst 1 priority 4096   ! Switch A
spanning-tree mst 2 priority 4096   ! Switch B
\`\`\`

## رفع مشکلات STP

\`\`\`cisco
show spanning-tree vlan 10 | include Root ID
show spanning-tree detail | include topology
show interfaces status err-disabled
\`\`\``,
  },
  'cisco-ospf-enterprise': {
    contentEn: `## Introduction

OSPF on Cisco IOS is the most common IGP (Interior Gateway Protocol) in enterprise networks. Unlike the MikroTik OSPF guide, Cisco's OSPF configuration uses a different syntax and has unique enterprise features like route redistribution, virtual links, and stub areas.

## OSPF Fundamentals

OSPF is a link-state protocol — every router knows the complete topology (LSDB). Routers calculate shortest paths using Dijkstra's algorithm.

**Key Terms:**
- **Router ID**: Unique identifier for each OSPF router (highest loopback IP by default)
- **Area**: Group of routers sharing the same LSDB
- **ABR**: Area Border Router — connects multiple areas
- **ASBR**: Autonomous System Boundary Router — redistributes external routes into OSPF
- **LSA**: Link State Advertisement — the unit of OSPF topology information

## Basic OSPF Configuration

\`\`\`cisco
! Enable OSPF process (number is local only, doesn't need to match peers)
router ospf 1

! Set Router ID explicitly (best practice)
router-id 10.0.0.1

! Advertise networks in OSPF
network 10.0.0.0 0.0.0.255 area 0     ! All /24 in 10.0.0.x → backbone area
network 192.168.1.0 0.0.0.255 area 1  ! Branch network → area 1
network 10.10.10.10 0.0.0.0 area 0    ! Loopback → backbone

! Or configure OSPF per-interface (modern recommended approach)
interface GigabitEthernet0/0
 ip ospf 1 area 0
 ip ospf cost 10
 ip ospf hello-interval 5
 ip ospf dead-interval 20
\`\`\`

## OSPF Authentication (MD5)

Always enable authentication to prevent rogue router injection:

\`\`\`cisco
! Interface-level MD5 auth
interface GigabitEthernet0/0
 ip ospf authentication message-digest
 ip ospf message-digest-key 1 md5 YourSecretKey

! Area-level auth (applies to all interfaces in area)
router ospf 1
 area 0 authentication message-digest
\`\`\`

## Area Types and Design

\`\`\`cisco
! Regular area (full LSA flooding)
router ospf 1
 area 1 range 192.168.1.0 255.255.255.0  ! Summarize area 1 at ABR

! Stub area (no external LSAs from ASBR)
router ospf 1
 area 2 stub
! All routers in area 2 must also have: area 2 stub

! Totally Stubby area (no external, no summary LSAs — only default route)
router ospf 1
 area 2 stub no-summary  ! Only on ABR
! Regular routers in area: area 2 stub

! NSSA (Not-So-Stubby Area) — allows ASBR inside stub area
router ospf 1
 area 3 nssa
\`\`\`

## Route Redistribution

Import routes from other protocols into OSPF:

\`\`\`cisco
! Redistribute connected networks
router ospf 1
 redistribute connected subnets metric 10 metric-type 1

! Redistribute static routes
router ospf 1
 redistribute static subnets

! Redistribute from BGP
router ospf 1
 redistribute bgp 65001 subnets metric 10

! Redistribute from EIGRP with filtering
router ospf 1
 redistribute eigrp 10 subnets route-map EIGRP-TO-OSPF

route-map EIGRP-TO-OSPF permit 10
 match ip address prefix-list ALLOWED-PREFIXES
ip prefix-list ALLOWED-PREFIXES permit 10.0.0.0/8 le 24
\`\`\`

## BFD for Sub-Second Failure Detection

\`\`\`cisco
! BFD replaces OSPF dead-interval for faster failure detection
interface GigabitEthernet0/0
 bfd interval 300 min_rx 300 multiplier 3  ! Detect failure in 900ms

router ospf 1
 bfd all-interfaces  ! Enable BFD for all OSPF interfaces
\`\`\`

## Verifying OSPF

\`\`\`cisco
! View OSPF neighbors
show ip ospf neighbor

! Detailed neighbor info
show ip ospf neighbor detail

! View OSPF link-state database
show ip ospf database

! View specific LSA type
show ip ospf database router      ! Type 1 LSAs
show ip ospf database network     ! Type 2 LSAs
show ip ospf database summary     ! Type 3 LSAs (inter-area)
show ip ospf database external    ! Type 5 LSAs (external routes)

! View OSPF routes
show ip route ospf

! View OSPF interface info
show ip ospf interface brief

! Check process info
show ip ospf
\`\`\`

## Common OSPF Issues

\`\`\`cisco
! Issue: Neighbors stuck in EXSTART/EXCHANGE
! Cause: MTU mismatch
interface GigabitEthernet0/0
 ip ospf mtu-ignore

! Issue: Neighbors not forming (check timers)
! Hello/Dead must match between neighbors
show ip ospf interface GigabitEthernet0/0 | include intervals

! Issue: Route not appearing in table
! Check that network statement covers the interface
debug ip ospf events
debug ip ospf adj

! Issue: Flapping adjacency
! Look for BFD mismatches or unreliable links
show ip ospf statistics
\`\`\``,
    contentFa: `## مقدمه

OSPF روی Cisco IOS رایج‌ترین IGP در شبکه‌های سازمانی است.

## پیکربندی پایه OSPF

\`\`\`cisco
router ospf 1
router-id 10.0.0.1

network 10.0.0.0 0.0.0.255 area 0
network 192.168.1.0 0.0.0.255 area 1

! رویکرد مدرن: پیکربندی per-interface
interface GigabitEthernet0/0
 ip ospf 1 area 0
 ip ospf cost 10
\`\`\`

## احراز هویت OSPF (MD5)

\`\`\`cisco
interface GigabitEthernet0/0
 ip ospf authentication message-digest
 ip ospf message-digest-key 1 md5 YourSecretKey
\`\`\`

## انواع Area

\`\`\`cisco
! Stub area
router ospf 1
 area 2 stub

! Totally Stubby (فقط روی ABR)
 area 2 stub no-summary

! NSSA
 area 3 nssa
\`\`\`

## تأیید OSPF

\`\`\`cisco
show ip ospf neighbor
show ip ospf database
show ip route ospf
show ip ospf interface brief
\`\`\``,
  },
  'cisco-aci-fundamentals': {
    contentEn: `## Introduction

Cisco ACI (Application Centric Infrastructure) is a Software-Defined Networking (SDN) solution for data centers. Unlike traditional networking where you configure each device individually, ACI uses a centralized controller (APIC) and a policy-based model. This guide covers ACI fundamentals for engineers transitioning from traditional networking.

## ACI vs Traditional Networking

| Concept | Traditional | ACI Equivalent |
|---------|------------|----------------|
| VLAN | VLAN | EPG (Endpoint Group) |
| IP Subnet | IP Subnet | BD (Bridge Domain) |
| VRF | VRF | VRF (Context) |
| Routing | Static/OSPF/BGP | L3Out |
| Security | ACL/Firewall | Contract |
| Grouping | VLAN membership | EPG membership |

## ACI Logical Model

\`\`\`
Tenant (customer or department)
 └── VRF (Layer 3 domain)
      └── BD (Bridge Domain = L2 + L3)
           └── EPG (Endpoint Group = endpoints with same policy)
                └── Contracts (allow/deny between EPGs)
\`\`\`

## ACI Physical Model

\`\`\`
APIC Cluster (3+ controllers)
 └── Spine Switches (high-speed fabric)
      └── Leaf Switches (ToR - Top of Rack)
           └── Servers, Firewalls, Load Balancers
\`\`\`

All traffic between leaves goes through a spine — there's no direct leaf-to-leaf connection.

## Key Concepts

### EPG (Endpoint Group)
- All VMs/servers with the same security policy belong to the same EPG
- An EPG can span multiple leaf switches
- Endpoints (VMs) are discovered automatically when they connect

### BD (Bridge Domain)
- Defines the L2 and L3 domain
- Has one or more subnets (like an SVI)
- Controls ARP behavior (unicast or flood)

### Contract
- Defines allowed traffic between EPGs
- Replaces traditional ACLs
- Applied between provider and consumer EPGs

### L3Out
- External Layer 3 connectivity (to internet, WAN, non-ACI networks)
- Can run OSPF, BGP, or EIGRP with external routers

## Basic Tenant Configuration (via GUI)

1. Create Tenant: \`Tenant → Add Tenant → Name: Production\`

2. Create VRF: \`Networking → VRFs → + → Name: Prod-VRF\`

3. Create BD: \`Networking → Bridge Domains → + → Name: Web-BD\`
   - Assign to Prod-VRF
   - Add subnet: 192.168.10.1/24

4. Create EPGs:
   - \`Application Profiles → + → Web-App\`
   - \`EPGs → + → Web-EPG → assign to Web-BD\`
   - \`EPGs → + → DB-EPG → assign to DB-BD\`

5. Create Contract:
   - \`Contracts → + → Web-to-DB → Port 3306\`
   - Apply: DB-EPG provides, Web-EPG consumes

## ACI via REST API

ACI has a full REST API — great for automation:

\`\`\`python
import requests
import json

APIC = "https://apic.company.com"
USERNAME = "admin"
PASSWORD = "yourpassword"

# Login
login_data = {"aaaUser": {"attributes": {"name": USERNAME, "pwd": PASSWORD}}}
response = requests.post(f"{APIC}/api/aaaLogin.json", json=login_data, verify=False)
token = response.json()["imdata"][0]["aaaLogin"]["attributes"]["token"]
cookies = {"APIC-cookie": token}

# Create a tenant
tenant_data = {
    "fvTenant": {
        "attributes": {
            "name": "NewTenant",
            "descr": "Created via API"
        }
    }
}
response = requests.post(
    f"{APIC}/api/node/mo/uni/tn-NewTenant.json",
    json=tenant_data,
    cookies=cookies,
    verify=False
)
print(response.status_code)

# Get all EPGs
response = requests.get(
    f"{APIC}/api/node/class/fvAEPg.json",
    cookies=cookies,
    verify=False
)
epgs = response.json()["imdata"]
for epg in epgs:
    print(epg["fvAEPg"]["attributes"]["dn"])
\`\`\`

## ACI with Ansible

\`\`\`yaml
# Install collection
# ansible-galaxy collection install cisco.aci

- name: Create ACI Tenant
  hosts: apic
  gather_facts: no
  tasks:
    - name: Create tenant
      cisco.aci.aci_tenant:
        host: "{{ apic_host }}"
        username: "{{ apic_username }}"
        password: "{{ apic_password }}"
        tenant: Production
        description: "Production tenant"
        state: present
        validate_certs: no

    - name: Create VRF
      cisco.aci.aci_vrf:
        host: "{{ apic_host }}"
        username: "{{ apic_username }}"
        password: "{{ apic_password }}"
        tenant: Production
        vrf: Prod-VRF
        state: present
        validate_certs: no

    - name: Create EPG
      cisco.aci.aci_epg:
        host: "{{ apic_host }}"
        username: "{{ apic_username }}"
        password: "{{ apic_password }}"
        tenant: Production
        ap: Web-App
        epg: Web-EPG
        bd: Web-BD
        state: present
        validate_certs: no
\`\`\`

## Troubleshooting ACI

\`\`\`bash
# On APIC CLI
show tenant <tenant-name>
show epg
show contract

# On Leaf CLI (SSH to leaf)
show endpoint
show vlan extended
show ip arp

# Faults (check APIC GUI)
# Tenant → Operational → Faults
# Look for: BD/EPG not deployed, Contract misconfiguration

# Trace a packet between EPGs
# APIC → Troubleshoot → Endpoint Reachability
\`\`\``,
    contentFa: `## مقدمه

Cisco ACI یک راه‌حل SDN برای مراکز داده است. برخلاف شبکه سنتی که هر دستگاه را جداگانه پیکربندی می‌کنید، ACI از یک کنترلر متمرکز (APIC) و مدل مبتنی بر سیاست استفاده می‌کند.

## مقایسه ACI با شبکه سنتی

| مفهوم | سنتی | معادل ACI |
|------|------|----------|
| VLAN | VLAN | EPG |
| زیرشبکه IP | زیرشبکه | BD |
| VRF | VRF | VRF (Context) |
| امنیت | ACL/فایروال | Contract |

## مدل منطقی ACI

\`\`\`
Tenant
 └── VRF (دامنه لایه ۳)
      └── BD (Bridge Domain)
           └── EPG (گروه Endpoint)
                └── Contracts
\`\`\`

## ACI با REST API

\`\`\`python
import requests

APIC = "https://apic.company.com"
login_data = {"aaaUser": {"attributes": {"name": "admin", "pwd": "yourpassword"}}}
response = requests.post(f"{APIC}/api/aaaLogin.json", json=login_data, verify=False)
token = response.json()["imdata"][0]["aaaLogin"]["attributes"]["token"]
cookies = {"APIC-cookie": token}

# دریافت همه EPG‌ها
response = requests.get(f"{APIC}/api/node/class/fvAEPg.json", cookies=cookies, verify=False)
\`\`\`

## ACI با Ansible

\`\`\`yaml
- name: ایجاد Tenant
  cisco.aci.aci_tenant:
    host: "{{ apic_host }}"
    username: "{{ apic_username }}"
    password: "{{ apic_password }}"
    tenant: Production
    state: present
    validate_certs: no
\`\`\``,
  },
  'cisco-multicast-pim': {
    contentEn: `## Introduction

Multicast allows a single sender to deliver data to multiple receivers simultaneously without sending multiple unicast copies. It's critical for video streaming, IPTV, financial data feeds, and conferencing. PIM (Protocol Independent Multicast) is the routing protocol that builds multicast distribution trees.

## Multicast Addressing

- Multicast group IPs: **224.0.0.0/4** (224.x.x.x to 239.x.x.x)
- Well-known addresses:
  - 224.0.0.1 — all hosts on subnet
  - 224.0.0.2 — all routers on subnet
  - 224.0.0.5 — OSPF routers
  - 224.0.0.9 — RIP v2 routers

## PIM Modes

| Mode | Use Case | Requires RP? |
|------|----------|-------------|
| PIM-SM (Sparse Mode) | Most enterprise/internet | Yes (RP) |
| PIM-SSM (Source-Specific) | Known source, better security | No RP |
| PIM-DM (Dense Mode) | Small networks, legacy | No |
| PIM-BIDIR | Many-to-many (conferencing) | Yes (RP) |

## PIM Sparse Mode Configuration

### Step 1: Enable multicast routing

\`\`\`cisco
ip multicast-routing distributed
\`\`\`

### Step 2: Enable PIM on interfaces

\`\`\`cisco
interface GigabitEthernet0/0
 ip pim sparse-mode

interface GigabitEthernet0/1
 ip pim sparse-mode
\`\`\`

### Step 3: Configure Rendezvous Point (RP)

The RP is the meeting point for senders and receivers.

Option A: Static RP (simple, no redundancy):
\`\`\`cisco
ip pim rp-address 10.0.0.10
\`\`\`

Option B: Auto-RP (Cisco-proprietary, automatic RP discovery):
\`\`\`cisco
! On the RP router
ip pim send-rp-announce Loopback0 scope 16
ip pim send-rp-discovery Loopback0 scope 16

! On all other routers
ip pim autorp listener
\`\`\`

Option C: BSR (Bootstrap Router, standards-based):
\`\`\`cisco
! On BSR router
ip pim bsr-candidate Loopback0 0

! On candidate RP
ip pim rp-candidate Loopback0 priority 10

! On all routers
! (nothing needed — they learn BSR automatically)
\`\`\`

## IGMP (Internet Group Management Protocol)

Hosts use IGMP to join/leave multicast groups. Routers use it to track group membership.

\`\`\`cisco
! Enable IGMP (automatic when PIM is enabled)
interface GigabitEthernet0/2
 ip igmp version 3          ! IGMPv3 for SSM
 ip igmp query-interval 60  ! How often to query hosts
 ip igmp query-max-response-time 10

! Static group join (for testing)
interface GigabitEthernet0/2
 ip igmp join-group 239.1.1.1

! Limit groups on untrusted port
interface GigabitEthernet0/3
 ip igmp max-groups 10  ! Maximum 10 groups
\`\`\`

## PIM-SSM (Source-Specific Multicast)

SSM is more secure — receivers specify both group AND source:

\`\`\`cisco
! Enable SSM for 232.x.x.x range
ip pim ssm range 232.0.0.0/8

! Or custom range
ip access-list standard SSM-RANGE
 permit 239.1.0.0 0.0.255.255
ip pim ssm range SSM-RANGE
\`\`\`

## Verification

\`\`\`cisco
! View PIM neighbors
show ip pim neighbor

! View multicast routing table
show ip mroute

! View IGMP group membership
show ip igmp groups

! View RP mapping
show ip pim rp

! View PIM interface info
show ip pim interface

! Debug (use carefully in production)
debug ip pim
debug ip igmp
\`\`\`

## Multicast Traffic Flow Example

1. Sender starts streaming to 239.1.1.1
2. Sender's router creates (S,G) entry: (192.168.1.10, 239.1.1.1)
3. Data travels to RP via unicast (RPT — RP Tree)
4. RP distributes to all receivers via shared tree
5. Once traffic flows, receivers can switch to SPT (Shortest Path Tree) directly to sender

\`\`\`cisco
! View the multicast tree
show ip mroute 239.1.1.1

! Output:
! (*, 239.1.1.1), 00:30:12/00:02:44, RP 10.0.0.10, flags: S
!   Incoming interface: GigabitEthernet0/0
!   RPF nbr 10.0.0.10
!   Outgoing interface list:
!     GigabitEthernet0/1, Forward/Sparse, 00:30:12/00:02:44
!
! (192.168.1.10, 239.1.1.1), 00:15:05/00:02:59, flags: T
!   Incoming interface: GigabitEthernet0/0 (shortest path to source)
!   Outgoing interface list: GigabitEthernet0/1
\`\`\`

## IGMP Snooping (on Switches)

Prevents multicast from flooding all ports on a VLAN:

\`\`\`cisco
! Enable (on by default on Catalyst)
ip igmp snooping vlan 10

! View snooping table
show ip igmp snooping groups vlan 10

! Configure querier (one switch per VLAN should be querier)
ip igmp snooping vlan 10 querier address 192.168.10.1
\`\`\``,
    contentFa: `## مقدمه

Multicast به یک فرستنده اجازه می‌دهد داده را به چندین گیرنده بدون ارسال چندین کپی unicast تحویل دهد. PIM پروتکل مسیریابی است که درخت‌های توزیع multicast را می‌سازد.

## پیکربندی PIM Sparse Mode

\`\`\`cisco
! فعال‌سازی multicast routing
ip multicast-routing distributed

! فعال‌سازی PIM روی رابط‌ها
interface GigabitEthernet0/0
 ip pim sparse-mode

! پیکربندی RP
ip pim rp-address 10.0.0.10

! یا Auto-RP
ip pim send-rp-announce Loopback0 scope 16
ip pim send-rp-discovery Loopback0 scope 16
\`\`\`

## IGMP

\`\`\`cisco
interface GigabitEthernet0/2
 ip igmp version 3
 ip igmp query-interval 60
 ip igmp max-groups 10
\`\`\`

## تأیید

\`\`\`cisco
show ip pim neighbor
show ip mroute
show ip igmp groups
show ip pim rp
\`\`\``,
  },
  'cisco-sdaccess': {
    contentEn: `## Introduction

Cisco SD-Access (Software-Defined Access) is a next-generation campus network solution that uses an overlay fabric (VXLAN+LISP) to provide policy-based segmentation, automation, and simplified management through DNA Center (Catalyst Center).

## SD-Access vs Traditional Campus

| Feature | Traditional | SD-Access |
|---------|------------|----------|
| Segmentation | VLAN-based | VN (Virtual Network) |
| Policy | Per-VLAN ACL | SGT (Security Group Tags) |
| Mobility | Re-IP when roaming | IP preserved |
| Provisioning | CLI per device | DNA Center templates |
| Troubleshooting | CLI on each box | DNA Center Assurance |

## SD-Access Architecture

\`\`\`
DNA Center (Controller)
    |
Fabric Control Plane
    └── LISP (Locator/ID Separation Protocol)
         → Maps endpoint identity to location
    └── IS-IS (underlay routing)
         → Physical connectivity
    └── VXLAN (overlay tunnels)
         → Carries tenant traffic
    └── TrustSec SGT (policy)
         → Micro-segmentation
\`\`\`

## Physical Components

- **Underlay**: IP routed network (IS-IS between fabric nodes)
- **Control Plane Node**: Runs LISP Map Server/Resolver (usually Border node)
- **Border Node**: Connects SD-Access fabric to external networks (WAN, datacenter)
- **Edge Node**: ToR switch where endpoints connect
- **Fabric Wireless**: WLCs and APs inside the fabric

## DNA Center Installation

DNA Center runs on dedicated Cisco UCS hardware or virtual appliances:

1. Deploy DNA Center OVA or physical appliance
2. Initial configuration via browser wizard
3. Add devices to inventory (Cisco Discovery Protocol auto-discovers)
4. Assign roles: Edge, Border, Control Plane

## Fabric Configuration via DNA Center

### Step 1: Create Network Hierarchy

\`\`\`
DNA Center → Design → Network Hierarchy
Global → Country → State → Building → Floor
\`\`\`

### Step 2: Design Network Settings

\`\`\`
Design → Network Settings:
- DNS: 8.8.8.8, 8.8.4.4
- NTP: ntp.company.com
- DHCP: 10.0.0.10
- AAA: ISE server
\`\`\`

### Step 3: Create Virtual Networks (VNs)

\`\`\`
Policy → Virtual Network
- Guest VN: isolated, internet-only
- Corp VN: full access
- IoT VN: restricted
\`\`\`

### Step 4: Create Scalable Groups (SGTs)

\`\`\`
Policy → Group-Based Access Control → Scalable Groups:
- Employees (SGT 10)
- Contractors (SGT 20)
- IoT-Devices (SGT 30)
- Finance (SGT 40)
\`\`\`

### Step 5: Define Policy Matrix

\`\`\`
Policy Matrix (who can talk to whom):
           Employees   Contractors   Finance   IoT
Employees     Allow       Allow        Deny    Deny
Contractors   Allow       Allow        Deny    Deny
Finance       Allow       Deny         Allow   Deny
IoT           Deny        Deny         Deny    Deny
\`\`\`

### Step 6: Provision Fabric

\`\`\`
Provision → Fabric Sites:
1. Select devices for fabric
2. Assign roles (Edge, Border, Control Plane)
3. Deploy → pushes config to all devices via NETCONF/RESTCONF
\`\`\`

## Troubleshooting SD-Access

### Via DNA Center Assurance

\`\`\`
Assurance → Network Health:
- View health scores for all fabric nodes
- Client 360: complete view of a specific client's connectivity
- Path Trace: trace actual packet path through the fabric
\`\`\`

### Via CLI on Fabric Nodes

\`\`\`cisco
! Check LISP map cache (where is this endpoint?)
show lisp instance-id 4099 ipv4 map-cache

! View VXLAN tunnels
show nve peers
show nve interface nve1

! Check TrustSec SGT
show cts interface GigabitEthernet1/0/1
show cts rbacl

! View fabric configuration
show fabric forwarding address-table

! Check IS-IS underlay
show isis neighbors
show isis database
\`\`\`

## SD-Access Wireless Integration

\`\`\`
WLC is a fabric-mode WLC, registered with DNA Center
APs join WLC as fabric mode APs
When client connects:
  1. AP sends RLOC (fabric tunnel) to fabric edge
  2. LISP registers client MAC/IP in control plane
  3. Client gets policy based on authentication (ISE assigns SGT)
\`\`\`

## ISE Integration for Policy

SD-Access requires Cisco ISE for:
- 802.1X authentication
- SGT assignment based on user identity
- Dynamic VLAN/VN assignment
- Posture assessment (is device compliant?)

\`\`\`
ISE Authorization Policy:
IF user in AD group "Employees" AND device certificate valid
THEN assign SGT=10, VLAN=Corp-VN
\`\`\``,
    contentFa: `## مقدمه

Cisco SD-Access یک راه‌حل شبکه campus نسل بعدی است که از VXLAN+LISP برای تقسیم‌بندی مبتنی بر سیاست از طریق DNA Center استفاده می‌کند.

## معماری SD-Access

\`\`\`
DNA Center (کنترلر)
    |
Fabric Control Plane
    └── LISP (نگاشت هویت endpoint به مکان)
    └── IS-IS (مسیریابی underlay)
    └── VXLAN (تونل‌های overlay)
    └── TrustSec SGT (micro-segmentation)
\`\`\`

## پیکربندی Fabric از طریق DNA Center

۱. ایجاد سلسله‌مراتب شبکه
۲. طراحی تنظیمات شبکه (DNS، NTP، DHCP)
۳. ایجاد Virtual Networks (VN‌ها)
۴. ایجاد گروه‌های مقیاس‌پذیر (SGT)
۵. تعریف ماتریس سیاست
۶. Provision Fabric

## رفع عیب SD-Access

\`\`\`cisco
show lisp instance-id 4099 ipv4 map-cache
show nve peers
show cts interface GigabitEthernet1/0/1
show isis neighbors
\`\`\``,
  },
  'vmware-vsan-configuration': {
    contentEn: `## Introduction

vSAN (Virtual SAN) is VMware's hyperconverged storage solution built into vSphere. Instead of external SAN/NAS storage, vSAN uses local disks on ESXi hosts and creates a shared datastore across the cluster. This guide covers design decisions, deployment, and management.

## vSAN Architecture

\`\`\`
ESXi Host 1        ESXi Host 2        ESXi Host 3
[NVMe Cache]       [NVMe Cache]       [NVMe Cache]
[HDD Capacity]     [HDD Capacity]     [HDD Capacity]
[HDD Capacity]     [HDD Capacity]     [HDD Capacity]
       |                  |                  |
       └──────────────────┴──────────────────┘
                    vSAN Network (10GbE+)
                    vSAN Datastore (shared)
\`\`\`

## Disk Groups

Each host contributes one or more **disk groups** to vSAN:
- 1 cache tier disk (NVMe or SSD) per disk group
- 1-7 capacity tier disks (HDD or SSD) per disk group

Cache handles write buffering and read caching. Capacity stores the actual data.

## Requirements

- Minimum 3 ESXi hosts (for FTT=1 with RAID-1)
- vSAN license (Standard, Advanced, Enterprise)
- 10GbE dedicated vSAN network (25GbE recommended)
- Solid-state cache tier
- Same hardware across hosts is NOT required but simplifies management

## vSAN Storage Policies

vSAN uses storage policies to control data protection:

**FTT (Failures To Tolerate)**:
- FTT=1, RAID-1: 3 hosts minimum, 2x overhead
- FTT=1, RAID-5: 4 hosts minimum, 1.33x overhead (erasure coding)
- FTT=2, RAID-6: 6 hosts minimum, 1.5x overhead

## Enabling vSAN

1. In vCenter, select cluster → Configure → vSAN → Services
2. Enable vSAN
3. Configure vSAN network (VMkernel adapter with vSAN traffic type)
4. Add disk groups from each host

Via PowerCLI:

\`\`\`powershell
# Connect to vCenter
Connect-VIServer -Server vcenter.company.com

# Enable vSAN on cluster
$cluster = Get-Cluster "Production"
Set-VsanClusterConfiguration -Cluster $cluster -VsanEnabled $true

# Configure disk groups
$hosts = Get-VMHost -Location $cluster
foreach ($esxiHost in $hosts) {
    $cacheDisk = Get-VMHostDisk -VMHost $esxiHost | Where-Object {$_.CapacityGB -lt 500 -and $_.SSDEnabled}
    $capacityDisks = Get-VMHostDisk -VMHost $esxiHost | Where-Object {$_.CapacityGB -gt 500}
    
    New-VsanDiskGroup -VMHost $esxiHost -SsdCanonicalName $cacheDisk.CanonicalName \`
        -DataDiskCanonicalName ($capacityDisks | Select-Object -ExpandProperty CanonicalName)
}
\`\`\`

## Creating Storage Policies

In vCenter: Policies and Profiles → VM Storage Policies → Create

Or via PowerCLI:

\`\`\`powershell
# Create policy with FTT=1, RAID-5 (erasure coding)
$rules = New-SpbmRuleSet -AllOfRules @(
    New-SpbmRule -Capability (Get-SpbmCapability -Name "VSAN.hostFailuresToTolerate") -Value 1,
    New-SpbmRule -Capability (Get-SpbmCapability -Name "VSAN.replicaPreference") -Value "RAID-5/RAID-6 (Erasure Coding) - Capacity"
)

New-SpbmStoragePolicy -Name "Gold-RAID5" -RuleSet $rules
\`\`\`

## vSAN Monitoring

\`\`\`powershell
# Check vSAN health
Get-VsanView -Id "VsanVcClusterHealthSystem-vsan-cluster-health-system" |
    ForEach-Object { $_.VsanQueryVcClusterHealthSummary($cluster.Id, $null, $null, $true, $null, $null) }

# Check disk health
Get-VsanDisk | Where-Object {$_.State -ne "inUse"} | Select-Object CanonicalName, State

# Check resync status
Get-VsanResyncStatus -Cluster $cluster

# Check vSAN capacity
Get-VsanSpaceUsage -Cluster $cluster
\`\`\`

## vSAN Fault Domains (Rack Awareness)

For multi-rack deployments, configure fault domains to ensure replicas don't land on the same rack:

\`\`\`powershell
# Create fault domains
New-VsanFaultDomain -Name "Rack-A" -VMHost @("esxi1", "esxi2", "esxi3") -Cluster $cluster
New-VsanFaultDomain -Name "Rack-B" -VMHost @("esxi4", "esxi5", "esxi6") -Cluster $cluster
New-VsanFaultDomain -Name "Rack-C" -VMHost @("esxi7", "esxi8", "esxi9") -Cluster $cluster
\`\`\`

## Stretched Cluster (Active-Active across 2 Sites)

\`\`\`
Site A (3 hosts) ←→ Witness Host ←→ Site B (3 hosts)
                 ↑
         Witness at third site or cloud
\`\`\`

Provides RPO=0 across sites — if Site A fails, Site B continues serving VMs from the same datastore.

## Troubleshooting vSAN

\`\`\`bash
# On ESXi host shell
# Check vSAN network
esxcli vsan network list

# Check disk health
esxcli storage core device list

# Check vSAN cluster status
esxcli vsan cluster get

# Check objects
esxcli vsan debug object list | head -20

# View vSAN logs
cat /var/log/vsanmgmt.log | grep -i error | tail -50
\`\`\``,
    contentFa: `## مقدمه

vSAN راه‌حل ذخیره‌سازی hyperconverged VMware است که در vSphere تعبیه شده است. به جای SAN/NAS خارجی، vSAN از دیسک‌های محلی روی ESXi host ها استفاده می‌کند.

## معماری vSAN

\`\`\`
ESXi Host 1 + 2 + 3
[دیسک Cache (NVMe/SSD)] + [دیسک Capacity (HDD/SSD)]
          |
    شبکه vSAN (10GbE+)
          |
    Datastore vSAN (مشترک)
\`\`\`

## فعال‌سازی vSAN با PowerCLI

\`\`\`powershell
Connect-VIServer -Server vcenter.company.com
$cluster = Get-Cluster "Production"
Set-VsanClusterConfiguration -Cluster $cluster -VsanEnabled $true

# پیکربندی disk group‌ها
$hosts = Get-VMHost -Location $cluster
foreach ($esxiHost in $hosts) {
    $cacheDisk = Get-VMHostDisk -VMHost $esxiHost | Where-Object {$_.SSDEnabled}
    $capacityDisks = Get-VMHostDisk -VMHost $esxiHost | Where-Object {$_.CapacityGB -gt 500}
    New-VsanDiskGroup -VMHost $esxiHost -SsdCanonicalName $cacheDisk.CanonicalName
}
\`\`\`

## سیاست‌های ذخیره‌سازی

- FTT=1، RAID-1: حداقل ۳ هاست
- FTT=1، RAID-5: حداقل ۴ هاست (overhead کمتر)
- FTT=2، RAID-6: حداقل ۶ هاست

## پایش vSAN

\`\`\`powershell
Get-VsanResyncStatus -Cluster $cluster
Get-VsanSpaceUsage -Cluster $cluster
Get-VsanDisk | Where-Object {$_.State -ne "inUse"}
\`\`\``,
  },
  'vcenter-upgrade-guide': {
    contentEn: `## Introduction

Upgrading vCenter Server is a critical operation that requires careful planning. Unlike ESXi upgrades, vCenter manages all your hosts and VMs — if something goes wrong, you lose management plane visibility. This guide covers upgrade planning, execution, and rollback.

## Upgrade Path Considerations

- Always check VMware Interoperability Matrix before upgrading
- vCenter must be same version or newer than ESXi hosts
- Upgrade vCenter first, then ESXi hosts
- You cannot skip major versions (e.g., 6.7 → 8.0 requires going through 7.0)

## Pre-Upgrade Checklist

\`\`\`bash
# 1. Take a snapshot of vCenter VM (if running as VM)
# VMs can be snapshotted without stopping management

# 2. Backup vCenter
# Method 1: File-based backup via vCenter UI
# VAMI → Backup → Schedule/Trigger backup to NFS/SMB/FTP

# 3. Note current version
# vCenter UI → Menu → Administration → Deployment → System Configuration → Nodes

# 4. Check disk space
# VAMI (port 5480) → Monitor → Disk
# Need 50%+ free on /storage/db, /storage/log

# 5. Check services are healthy
# VAMI → Services → Verify all are running

# 6. Export certificates if using custom certs
# vCenter → Administration → Certificate Management → Export
\`\`\`

## vCenter Upgrade (VCSA)

vCenter Server Appliance (VCSA) upgrades differently from install — it's a "stage and upgrade" process.

### Method 1: ISO-based upgrade

1. Mount vCenter ISO
2. Open \`vcsa-ui-installer/lin64/installer\` (or win32 for Windows)
3. Select "Upgrade"
4. Connect to existing vCenter (source)
5. Wizard guides you through deploying the new appliance alongside the old one
6. At the end, data is migrated and old vCenter is shut down

### Method 2: GUI Upgrade

\`\`\`bash
# Run from the VCSA ISO
./vcsa-deploy upgrade --accept-eula   --precheck-only   /path/to/upgrade-config.json

# Then run actual upgrade
./vcsa-deploy upgrade --accept-eula   --no-esx-ssl-verify   /path/to/upgrade-config.json
\`\`\`

Upgrade config JSON:
\`\`\`json
{
  "__version": "2.13.0",
  "new_vcsa": {
    "esxi": {
      "hostname": "esxi-host.company.com",
      "username": "root",
      "password": "esxi_password",
      "deployment_network": "VM Network",
      "datastore": "local_datastore"
    },
    "appliance": {
      "thin_disk_mode": true,
      "deployment_option": "small",
      "name": "vcenter-new"
    },
    "network": {
      "ip_family": "ipv4",
      "mode": "static",
      "ip": "10.0.0.11",
      "dns_servers": ["8.8.8.8"],
      "prefix": "24",
      "gateway": "10.0.0.1",
      "system_name": "vcenter.company.com"
    },
    "os": {
      "password": "new_root_password",
      "ssh_enable": true
    },
    "sso": {
      "first_instance": true,
      "site_name": "Default"
    }
  },
  "source_vcsa": {
    "hostname": "old-vcenter.company.com",
    "username": "administrator@vsphere.local",
    "password": "old_password",
    "ssl_certificate_verification": false
  },
  "ceip": {
    "settings": {
      "ceip_enabled": false
    }
  }
}
\`\`\`

## Post-Upgrade Verification

\`\`\`powershell
# Connect to new vCenter
Connect-VIServer -Server vcenter.company.com

# Check all hosts are connected
Get-VMHost | Select-Object Name, ConnectionState, Version

# Check all VMs are accessible
Get-VM | Where-Object {$_.PowerState -ne "PoweredOn"} | Select-Object Name, PowerState

# Verify vSAN status
Get-VsanClusterConfiguration

# Check DRS/HA
Get-Cluster | Select-Object Name, DrsEnabled, HaEnabled

# Verify vCenter build number
$si = Get-View ServiceInstance
$si.Content.About
\`\`\`

## Rollback Options

If upgrade fails during Stage 1 (before data migration), original vCenter is unaffected — just remove the new appliance.

If upgrade fails during Stage 2 (data migration), you have limited options:
1. If vCenter VM was snapshotted — revert snapshot
2. If file-based backup exists — restore from backup
3. Contact VMware support

## Common Upgrade Issues

\`\`\`bash
# Issue: Disk space insufficient
df -h /storage/db
df -h /storage/log

# Clean old logs
/usr/lib/vmware-vpx/scripts/cleanupdb.sh

# Issue: Services not starting post-upgrade
# Check VAMI → Services → start failed service

# Issue: Certificate errors after upgrade
# Reset machine SSL certificate
/usr/lib/vmware-vmafd/bin/vecs-cli

# Issue: Linked mode vCenter upgrade order
# Must upgrade all vCenters in Enhanced Linked Mode simultaneously
\`\`\``,
    contentFa: `## مقدمه

ارتقاء vCenter Server یک عملیات حیاتی است که نیاز به برنامه‌ریزی دقیق دارد.

## چک‌لیست قبل از ارتقاء

\`\`\`bash
# ۱. اسنپشات از VM vCenter
# ۲. پشتیبان‌گیری از vCenter (VAMI → Backup)
# ۳. بررسی نسخه فعلی
# ۴. بررسی فضای دیسک (VAMI → Monitor → Disk)
# ۵. بررسی سلامت سرویس‌ها (VAMI → Services)
\`\`\`

## روش ارتقاء VCSA

ارتقاء vCenter یک فرآیند "stage and upgrade" است:

۱. Mount کردن ISO vCenter
۲. اجرای wizard ارتقاء
۳. اتصال به vCenter موجود (source)
۴. استقرار appliance جدید کنار قدیمی
۵. مهاجرت داده
۶. خاموش شدن vCenter قدیمی

## تأیید بعد از ارتقاء

\`\`\`powershell
Connect-VIServer -Server vcenter.company.com
Get-VMHost | Select-Object Name, ConnectionState, Version
Get-VM | Where-Object {$_.PowerState -ne "PoweredOn"}
\`\`\``,
  },
  'nsx-t-networking-basics': {
    contentEn: `## Introduction

NSX-T (now called VMware NSX) is VMware's network virtualization platform. It creates a complete virtual network layer (switching, routing, firewall, load balancing) in software — independent of the physical underlay. This guide covers NSX-T fundamentals for data center engineers.

## NSX-T vs Traditional Networking

| Feature | Traditional | NSX-T |
|---------|------------|-------|
| Segmentation | VLAN | Logical Switch (Geneve overlay) |
| Routing | Physical router | Tier-0/Tier-1 Gateways |
| Firewall | Physical appliance | Distributed Firewall (on every hypervisor) |
| Load Balancing | Physical LB | NSX Load Balancer |
| Scope | Physical network | Any workload (VMs, containers, bare metal) |

## NSX-T Architecture

\`\`\`
NSX Manager (3-node cluster for HA)
    |
NSX Controllers (embedded in Manager in NSX-T 3.x)
    |
Transport Nodes (ESXi hosts + KVM hosts + bare metal)
    |
Transport Zones (defines scope of logical networks)
    |
Logical Switches → Segments (virtual networks)
Tier-0 Gateway → Connects to physical network (BGP peering)
Tier-1 Gateway → Connected to Tier-0, segments connect here
\`\`\`

## Key Concepts

### Segments (Logical Switches)
- Virtual L2 network, spans multiple hosts via Geneve overlay
- Each segment = one broadcast domain
- VMs connect to segments like physical NICs to a switch

### Tier-0 Gateway (T0)
- Northbound connectivity — connects to physical router via BGP or static
- Runs on Edge Nodes (dedicated NSX Edge VMs)
- Handles N/S traffic (to/from internet/WAN)

### Tier-1 Gateway (T1)
- Connects segments to T0
- Handles E/W routing between segments
- Distributed — runs on every hypervisor (no traffic hair-pinning)

### Distributed Firewall (DFW)
- Stateful firewall running inside each hypervisor kernel
- Applied at VM vNIC level — east-west traffic never leaves host
- Policy follows the VM wherever it vMotions

## NSX-T Installation Overview

1. Deploy NSX Manager OVF (3 nodes for HA)
2. Configure cluster VIP
3. Connect to vCenter (for ESXi fabric)
4. Prepare hosts (install NSX kernel modules)
5. Configure transport zones
6. Configure uplink profiles and transport nodes
7. Create segments, T0, T1

## Creating Logical Network (Segments)

Via NSX Manager UI → Networking → Segments → Add Segment:

\`\`\`
Name: web-segment
Connected Gateway: tier1-gateway
Transport Zone: overlay-TZ
Subnets: 192.168.10.1/24
\`\`\`

## Tier-0 Gateway with BGP

\`\`\`
Networking → Tier-0 Gateways → Add:
  Name: T0-Production
  HA Mode: Active-Active (for scale) or Active-Standby

Routing → BGP:
  Local AS: 65100
  BGP Neighbors: physical router IP, remote AS 65000

Route Redistribution:
  Connected Interfaces: Enable
  Tier-1 Subnets: Enable
\`\`\`

## Distributed Firewall Rules

\`\`\`
Security → Distributed Firewall → Add Policy:

Policy: "Web Tier Policy"
Rules:
  Allow Web → DB:3306 (TCP) - from web-sg to db-sg
  Allow HTTPS → Web:443 (TCP) - from any to web-sg
  Deny All → Web (TCP/UDP) - from any to web-sg

Security Groups:
  web-sg: VMs with tag "Role:Web"
  db-sg: VMs with tag "Role:Database"
\`\`\`

## NSX-T with Kubernetes (NCP)

NSX integrates with Kubernetes via NCP (NSX Container Plugin):

\`\`\`yaml
# NSX-T provides each Kubernetes namespace its own segment
# When a Pod is created, NSX automatically provisions:
# - IP from IPAM pool
# - Logical port on the segment
# - Firewall rules from NetworkPolicy

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-db
spec:
  podSelector:
    matchLabels:
      role: database
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: web
    ports:
    - protocol: TCP
      port: 3306
\`\`\`

## Troubleshooting NSX-T

\`\`\`bash
# On NSX Manager
get logical-switches
get logical-routers
get transport-nodes

# On ESXi host (after SSH)
nsxcli

# Check overlay tunnels
get host-switch
get vtep

# Check DFW rules
get firewall section list

# View DFW connection table
get firewall flows

# Path trace (GUI: Tools → Traceflow)
# Simulates a packet and shows exact path through overlay
\`\`\``,
    contentFa: `## مقدمه

NSX-T (VMware NSX) پلتفرم مجازی‌سازی شبکه VMware است که یک لایه شبکه مجازی کامل در نرم‌افزار ایجاد می‌کند.

## معماری NSX-T

\`\`\`
NSX Manager (خوشه ۳ نودی)
    |
Transport Nodes (ESXi host‌ها)
    |
Transport Zones → Segments (شبکه‌های مجازی)
Tier-0 Gateway → اتصال به شبکه فیزیکی (BGP)
Tier-1 Gateway → ارتباط Segment‌ها با T0
\`\`\`

## مفاهیم کلیدی

- **Segment**: شبکه L2 مجازی (مانند VLAN)
- **Tier-0**: اتصال Northbound به شبکه فیزیکی
- **Tier-1**: مسیریابی East-West بین Segment‌ها
- **DFW**: فایروال توزیع‌شده داخل هر hypervisor

## Distributed Firewall

\`\`\`
Policy: "Web Tier Policy"
Rules:
  Allow Web → DB:3306 (TCP)
  Allow HTTPS → Web:443
  Deny All → Web
\`\`\`

## رفع عیب NSX-T

\`\`\`bash
# روی ESXi host
nsxcli
get host-switch
get vtep
get firewall section list
\`\`\``,
  },
  'esxi-performance-tuning': {
    contentEn: `## Introduction

ESXi performance tuning is the art of getting maximum throughput from your physical hardware while maintaining stability. Poor tuning leads to VM latency, CPU ready, and balloon memory — all signs of resource contention. This guide covers systematic performance analysis and tuning.

## Performance Monitoring Tools

\`\`\`powershell
# PowerCLI: Get CPU ready (high value = CPU contention)
Get-Stat -Entity (Get-VM "my-vm") -Stat cpu.ready.summation -MaxSamples 20 | 
  Select-Object Value | Measure-Object -Property Value -Average

# Get memory balloon (high = memory pressure)
Get-Stat -Entity (Get-VM "my-vm") -Stat mem.vmmemctl.average -MaxSamples 5

# Get disk latency
Get-Stat -Entity (Get-VM "my-vm") -Stat disk.totalLatency.average -MaxSamples 5
\`\`\`

## CPU Tuning

### NUMA Awareness

Modern servers have multiple NUMA nodes (CPU socket + local RAM). VMs that span NUMA nodes suffer performance penalties.

\`\`\`powershell
# Check NUMA topology
Get-VMHost | Get-View | Select-Object -ExpandProperty Hardware | 
  Select-Object -ExpandProperty NumaInfo

# Constrain VM to a NUMA node
$vm = Get-VM "database-server"
$spec = New-Object VMware.Vim.VirtualMachineConfigSpec
$spec.NumaInfo = New-Object VMware.Vim.VirtualMachineVirtualNumaInfo
$spec.NumaInfo.CoresPerNumaNode = 8  # Match physical NUMA topology
($vm | Get-View).ReconfigVM_Task($spec)
\`\`\`

### CPU Hot Add vs Cold Add

\`\`\`powershell
# Enable CPU hot add (allows adding vCPUs without reboot)
$vm = Get-VM "app-server"
$spec = New-Object VMware.Vim.VirtualMachineConfigSpec
$spec.CpuHotAddEnabled = $true
($vm | Get-View).ReconfigVM_Task($spec)
\`\`\`

### Avoid vCPU Overcommit

Rule of thumb: don't exceed 4:1 vCPU:pCPU ratio for production workloads.

\`\`\`powershell
# Check vCPU to pCPU ratio per host
Get-VMHost | ForEach-Object {
    $host = $_
    $vCPUs = (Get-VM -Location $host | Measure-Object -Property NumCpu -Sum).Sum
    $pCPUs = $host.NumCpu
    [PSCustomObject]@{
        Host = $host.Name
        pCPUs = $pCPUs
        vCPUs = $vCPUs
        Ratio = [math]::Round($vCPUs / $pCPUs, 2)
    }
}
\`\`\`

## Memory Tuning

### Transparent Page Sharing (TPS)

TPS deduplicates identical memory pages across VMs. In security-hardened environments, TPS between VMs from different security domains should be disabled.

\`\`\`bash
# On ESXi host
esxcli system settings advanced set -o /Mem/ShareScanGHz -i 0  # Disable TPS
esxcli system settings advanced set -o /Mem/ShareForceSalting -i 2  # Salt pages per VM
\`\`\`

### Memory Overcommit Mechanisms

ESXi has 4 memory reclamation techniques (in order of preference):
1. **TPS**: Share identical pages
2. **Balloon driver**: Guest OS voluntarily gives up pages
3. **Swap**: Write VM pages to disk (avoid!)
4. **Compression**: Compress pages in memory (better than swap)

\`\`\`powershell
# Check memory reclamation on VMs
Get-VM | Get-Stat -Stat mem.vmmemctl.average,mem.swapped.average -MaxSamples 5 |
  Where-Object {$_.Value -gt 0} |
  Select-Object Entity, MetricId, Value
\`\`\`

## Storage Performance

### Storage I/O Control (SIOC)

SIOC prevents a single VM from monopolizing datastore I/O during contention.

\`\`\`powershell
# Enable SIOC on datastore
Get-Datastore "production-ds" | Set-Datastore -StorageIOControlEnabled $true

# Set I/O shares per VM
Get-VM "database-server" | Get-HardDisk | ForEach-Object {
    $spec = New-Object VMware.Vim.VirtualDiskConfigSpec
    $spec.Operation = "edit"
    $spec.Device = $_.ExtensionData
    $spec.Device.StorageIOAllocation.Shares.Level = "high"
    $spec.Device.StorageIOAllocation.Shares.Shares = 2000
}
\`\`\`

### VMware Paravirtual SCSI (PVSCSI)

PVSCSI controller provides higher throughput than LSI Logic for I/O-intensive VMs:

\`\`\`powershell
# Change VM to PVSCSI (requires shutdown)
$vm = Get-VM "high-io-vm"
$controller = New-Object VMware.Vim.VirtualDeviceConfigSpec
$controller.Operation = "add"
$controller.Device = New-Object VMware.Vim.ParaVirtualSCSIController
$controller.Device.BusNumber = 0
$controller.Device.SharedBus = "noSharing"
\`\`\`

## Network Performance

### VMXNET3 vs E1000

Always use VMXNET3 for production VMs — it has hardware offload for RSS, LRO, and TSO.

\`\`\`powershell
# Check VM NIC types
Get-VM | Get-NetworkAdapter | Where-Object {$_.Type -ne "Vmxnet3"} |
  Select-Object VM, Name, Type
\`\`\`

### VMkernel NIC Offloads

\`\`\`bash
# Enable LRO (Large Receive Offload) on vmkernel
esxcli system settings advanced set -o /Net/TcpipDefLROEnabled -i 1

# Check NIC offload capabilities
esxcli network nic get -n vmnic0 | grep -i offload
\`\`\`

## Performance Profiling Workflow

1. Identify problem: Guest OS shows high latency/CPU
2. Check CPU ready in vCenter Performance charts
3. Check memory balloon/swap stats
4. Check disk latency (> 20ms is problematic)
5. Check network drops/errors
6. Esxtop for real-time analysis:

\`\`\`bash
# SSH to ESXi, run esxtop
esxtop
# Press: c=CPU, m=memory, d=disk, n=network
# Look for: %RDY (CPU ready), MCTL (balloon), KAVG (kernel latency)
\`\`\``,
    contentFa: `## مقدمه

تنظیم کارایی ESXi هنر گرفتن حداکثر بازده از سخت‌افزار فیزیکی است. این راهنما تحلیل کارایی سیستماتیک و تنظیم را پوشش می‌دهد.

## ابزارهای پایش کارایی

\`\`\`powershell
# CPU Ready (بالا = رقابت CPU)
Get-Stat -Entity (Get-VM "my-vm") -Stat cpu.ready.summation -MaxSamples 20

# Memory Balloon (بالا = فشار حافظه)
Get-Stat -Entity (Get-VM "my-vm") -Stat mem.vmmemctl.average -MaxSamples 5

# تأخیر دیسک
Get-Stat -Entity (Get-VM "my-vm") -Stat disk.totalLatency.average -MaxSamples 5
\`\`\`

## تنظیم CPU

\`\`\`powershell
# بررسی نسبت vCPU به pCPU
Get-VMHost | ForEach-Object {
    $vCPUs = (Get-VM -Location $_ | Measure-Object -Property NumCpu -Sum).Sum
    $pCPUs = $_.NumCpu
    [PSCustomObject]@{Host=$_.Name; Ratio=[math]::Round($vCPUs/$pCPUs,2)}
}
\`\`\`

## تنظیم حافظه

مکانیزم‌های بازیابی حافظه ESXi (به ترتیب اولویت):
۱. TPS: اشتراک‌گذاری صفحات یکسان
۲. Balloon Driver: ترک داوطلبانه صفحات
۳. Swap: نوشتن صفحات روی دیسک (اجتناب کنید)
۴. Compression: فشرده‌سازی صفحات

## تنظیم ذخیره‌سازی

- PVSCSI بر LSI Logic برای VM‌های I/O فشرده ترجیح دارد
- SIOC از تسلط یک VM روی I/O datastore جلوگیری می‌کند

## تنظیم شبکه

همیشه از VMXNET3 استفاده کنید — hardware offload برای RSS، LRO و TSO دارد.

\`\`\`powershell
Get-VM | Get-NetworkAdapter | Where-Object {$_.Type -ne "Vmxnet3"} | Select-Object VM, Type
\`\`\``,
  },
  'proxmox-terraform-provider': {
    contentEn: `## Introduction

The Proxmox Terraform provider (bpg/proxmox) allows you to manage Proxmox VE resources — VMs, containers, storage, networks — using Infrastructure as Code. This enables repeatable, version-controlled infrastructure deployments.

## Prerequisites

- Proxmox VE 7.x or 8.x cluster
- Terraform 1.x installed
- API token from Proxmox

## Creating a Proxmox API Token

In Proxmox UI: Datacenter → Permissions → API Tokens → Add

\`\`\`bash
# Or via CLI
pveum apitoken add terraform@pve!terraform --privsep 0
pveum aclmod / -user terraform@pve -role Administrator
\`\`\`

## Terraform Provider Configuration

\`\`\`hcl
# versions.tf
terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.46"
    }
  }
}

# provider.tf
provider "proxmox" {
  endpoint  = "https://proxmox.company.com:8006"
  api_token = "terraform@pve!terraform=UUID-TOKEN-HERE"
  insecure  = false   # Set true if self-signed cert
}
\`\`\`

## Creating a VM from Template

\`\`\`hcl
# main.tf
resource "proxmox_virtual_environment_vm" "web_server" {
  name      = "web-server-01"
  node_name = "pve-node1"
  vm_id     = 201

  clone {
    vm_id   = 9000   # Source template ID
    full    = true   # Full clone
  }

  cpu {
    cores   = 4
    sockets = 1
    type    = "x86-64-v2-AES"
  }

  memory {
    dedicated = 4096  # MB
    floating  = 512   # Ballooning minimum
  }

  disk {
    datastore_id = "local-zfs"
    interface    = "scsi0"
    size         = 50      # GB
    iothread     = true
    discard      = "on"
  }

  network_device {
    bridge   = "vmbr0"
    vlan_id  = 10
    model    = "virtio"
  }

  initialization {
    ip_config {
      ipv4 {
        address = "192.168.10.50/24"
        gateway = "192.168.10.1"
      }
    }
    user_account {
      username = "admin"
      keys     = [file("~/.ssh/id_rsa.pub")]
    }
    dns {
      servers = ["8.8.8.8", "8.8.4.4"]
    }
  }

  started = true
}
\`\`\`

## Creating Multiple VMs with count

\`\`\`hcl
variable "web_server_count" {
  default = 3
}

resource "proxmox_virtual_environment_vm" "web_cluster" {
  count     = var.web_server_count
  name      = "web-\${count.index + 1}"
  node_name = "pve-node\${(count.index % 3) + 1}"  # Distribute across 3 nodes
  vm_id     = 201 + count.index

  clone {
    vm_id = 9000
    full  = true
  }

  cpu {
    cores = 2
  }

  memory {
    dedicated = 2048
  }

  initialization {
    ip_config {
      ipv4 {
        address = "192.168.10.\${50 + count.index}/24"
        gateway = "192.168.10.1"
      }
    }
  }
}

output "vm_ips" {
  value = [for vm in proxmox_virtual_environment_vm.web_cluster : 
           vm.initialization[0].ip_config[0].ipv4[0].address]
}
\`\`\`

## LXC Container with Terraform

\`\`\`hcl
resource "proxmox_virtual_environment_container" "app_container" {
  description = "Application container"
  node_name   = "pve-node1"

  initialization {
    hostname = "app-container-01"
    
    ip_config {
      ipv4 {
        address = "192.168.10.100/24"
        gateway = "192.168.10.1"
      }
    }
    
    user_account {
      keys     = [file("~/.ssh/id_rsa.pub")]
      password = "SecurePassword123"
    }
  }

  network_interface {
    name   = "eth0"
    bridge = "vmbr0"
  }

  disk {
    datastore_id = "local-zfs"
    size         = 20
  }

  cpu {
    cores = 2
  }

  memory {
    dedicated = 1024
    swap      = 512
  }

  operating_system {
    template_file_id = "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
    type             = "ubuntu"
  }

  started  = true
  unprivileged = true
}
\`\`\`

## Remote State and Workspaces

\`\`\`hcl
# backend.tf - Store state in S3 or HTTP backend
terraform {
  backend "s3" {
    bucket = "terraform-state"
    key    = "proxmox/production/terraform.tfstate"
    region = "us-east-1"
  }
}
\`\`\`

\`\`\`bash
# Initialize and apply
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Destroy specific resource
terraform destroy -target=proxmox_virtual_environment_vm.web_server

# Import existing VM
terraform import proxmox_virtual_environment_vm.existing_vm pve-node1/qemu/200
\`\`\``,
    contentFa: `## مقدمه

Terraform provider پراکسماکس به شما امکان می‌دهد منابع Proxmox VE — VM‌ها، کانتینرها، ذخیره‌سازی — را با Infrastructure as Code مدیریت کنید.

## پیکربندی Provider

\`\`\`hcl
terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.46"
    }
  }
}

provider "proxmox" {
  endpoint  = "https://proxmox.company.com:8006"
  api_token = "terraform@pve!terraform=UUID-TOKEN"
}
\`\`\`

## ایجاد VM از Template

\`\`\`hcl
resource "proxmox_virtual_environment_vm" "web_server" {
  name      = "web-server-01"
  node_name = "pve-node1"
  
  clone { vm_id = 9000; full = true }
  
  cpu { cores = 4 }
  memory { dedicated = 4096 }
  
  disk {
    datastore_id = "local-zfs"
    interface    = "scsi0"
    size         = 50
  }
  
  network_device { bridge = "vmbr0"; vlan_id = 10 }
  
  initialization {
    ip_config {
      ipv4 { address = "192.168.10.50/24"; gateway = "192.168.10.1" }
    }
    user_account {
      username = "admin"
      keys = [file("~/.ssh/id_rsa.pub")]
    }
  }
}
\`\`\`

## ایجاد چندین VM با count

\`\`\`hcl
resource "proxmox_virtual_environment_vm" "web_cluster" {
  count     = 3
  name      = "web-\${count.index + 1}"
  node_name = "pve-node\${(count.index % 3) + 1}"
  vm_id     = 201 + count.index
}
\`\`\``,
  },
  'proxmox-lxc-containers': {
    contentEn: `## Introduction

Proxmox LXC containers are system containers that share the host kernel but have their own filesystem, network, and processes. They're ideal for running services that don't need full VM isolation — web servers, databases, monitoring agents — with minimal overhead.

## LXC vs KVM in Proxmox

| Feature | LXC | KVM |
|---------|-----|-----|
| Overhead | Minimal (< 1%) | Moderate (5-10%) |
| Isolation | Namespace-based | Full hardware |
| Boot time | Seconds | 10-30 seconds |
| Use case | Linux services | Any OS, higher isolation |
| VMs in container | No | Yes |

## Downloading Container Templates

\`\`\`bash
# List available templates
pveam available --section system

# Download Ubuntu template
pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst

# Download Alpine (tiny, 3MB)
pveam download local alpine-3.18-default_20230607_amd64.tar.xz

# List downloaded templates
pveam list local
\`\`\`

## Creating LXC Containers

Via CLI:

\`\`\`bash
# Create Ubuntu container
pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst   --hostname web-server   --memory 2048   --swap 512   --cores 2   --net0 name=eth0,bridge=vmbr0,ip=192.168.1.100/24,gw=192.168.1.1   --storage local-zfs   --rootfs local-zfs:20   --password SecurePass123   --ssh-public-keys /root/.ssh/id_rsa.pub   --unprivileged 1   --features nesting=1

# Start the container
pct start 100

# Enter the container
pct enter 100

# Or SSH directly
ssh root@192.168.1.100
\`\`\`

## Container Configuration

\`\`\`bash
# View current config
pct config 100

# Change memory
pct set 100 --memory 4096

# Resize disk
pct resize 100 rootfs +10G

# Add additional disk
pct set 100 --mp0 local-zfs:5,mp=/data

# Change network
pct set 100 --net0 name=eth0,bridge=vmbr0,ip=192.168.1.101/24,gw=192.168.1.1
\`\`\`

## Privileged vs Unprivileged Containers

**Unprivileged** (recommended):
- UID/GID mapping: container root (0) maps to host user 100000
- Container can't escape to host even if compromised
- Some limitations: can't mount NFS, some kernel modules unavailable

**Privileged**:
- Container root = host root
- Required for: Docker-in-LXC, some network functions
- Security risk — use only when necessary

\`\`\`bash
# Create privileged container
pct create 101 ... --unprivileged 0

# Enable nesting (for Docker inside LXC)
pct set 100 --features nesting=1
\`\`\`

## Docker Inside LXC (Nesting)

\`\`\`bash
# On privileged container with nesting=1
pct set 100 --features nesting=1,keyctl=1
pct start 100
pct enter 100

# Inside the container
apt update && apt install -y docker.io
systemctl enable docker
docker run -d -p 80:80 nginx
\`\`\`

## Snapshots and Backups

\`\`\`bash
# Take snapshot
pct snapshot 100 before-update

# List snapshots
pct listsnapshot 100

# Rollback
pct rollback 100 before-update

# Delete snapshot
pct delsnapshot 100 before-update

# Backup container
vzdump 100 --storage backup-storage --mode snapshot

# Restore backup
pct restore 200 /var/lib/vz/dump/vzdump-lxc-100-*.tar.zst   --storage local-zfs
\`\`\`

## Bind Mounts (Share Host Directories)

\`\`\`bash
# Share host directory /data/website into container at /var/www
pct set 100 --mp0 /data/website,mp=/var/www

# Shared read-only
pct set 100 --mp0 /data/configs,mp=/etc/myapp,ro=1
\`\`\`

## Networking: Multiple Interfaces and VLANs

\`\`\`bash
# Add VLAN interface
pct set 100 --net1 name=eth1,bridge=vmbr0,tag=20,ip=10.20.0.100/24

# View all container networks
pct config 100 | grep net
\`\`\`

## Mass Deployment Script

\`\`\`bash
#!/bin/bash
TEMPLATE="local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
START_ID=200
COUNT=5

for i in $(seq 1 $COUNT); do
    CT_ID=$((START_ID + i))
    IP="192.168.1.$((100 + i))/24"
    
    pct create $CT_ID $TEMPLATE         --hostname "web-$i"         --memory 1024         --cores 1         --net0 name=eth0,bridge=vmbr0,ip=$IP,gw=192.168.1.1         --storage local-zfs         --rootfs local-zfs:10         --unprivileged 1         --start 1
    
    echo "Created CT $CT_ID: web-$i ($IP)"
done
\`\`\``,
    contentFa: `## مقدمه

کانتینرهای LXC در Proxmox کانتینرهای سیستمی هستند که kernel هاست را به اشتراک می‌گذارند اما سیستم‌فایل، شبکه و پروسس‌های خود را دارند.

## دانلود Template‌های کانتینر

\`\`\`bash
pveam available --section system
pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst
pveam list local
\`\`\`

## ایجاد کانتینر LXC

\`\`\`bash
pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst   --hostname web-server   --memory 2048   --cores 2   --net0 name=eth0,bridge=vmbr0,ip=192.168.1.100/24,gw=192.168.1.1   --rootfs local-zfs:20   --unprivileged 1   --features nesting=1

pct start 100
pct enter 100
\`\`\`

## اسنپشات و پشتیبان‌گیری

\`\`\`bash
pct snapshot 100 before-update
pct listsnapshot 100
pct rollback 100 before-update
vzdump 100 --storage backup-storage --mode snapshot
\`\`\`

## Docker داخل LXC

\`\`\`bash
pct set 100 --features nesting=1,keyctl=1
pct start 100
pct enter 100
apt install -y docker.io
docker run -d -p 80:80 nginx
\`\`\``,
  },
  'proxmox-gpu-passthrough': {
    contentEn: `## Introduction

GPU passthrough (PCI passthrough) lets you assign a physical GPU directly to a VM, giving it near-native performance. This is essential for machine learning workloads, video transcoding, gaming VMs, and GPU-accelerated applications. Proxmox supports this via IOMMU/VT-d.

## Requirements

- CPU: Intel VT-d or AMD-Vi (IOMMU support in BIOS)
- Motherboard: IOMMU enabled in BIOS
- GPU: Secondary GPU (can't pass through the GPU used for Proxmox display)
- Linux kernel 5.x+ (Proxmox 7+ uses kernel 5.15)

## Step 1: Enable IOMMU in GRUB

\`\`\`bash
# Edit GRUB config
nano /etc/default/grub

# For Intel CPU:
GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt"

# For AMD CPU:
GRUB_CMDLINE_LINUX_DEFAULT="quiet amd_iommu=on iommu=pt"

# Update GRUB
update-grub

# Reboot
reboot
\`\`\`

## Step 2: Verify IOMMU is Working

\`\`\`bash
# Should show IOMMU enabled
dmesg | grep -e IOMMU -e iommu

# List IOMMU groups (GPU must be in its own group)
for d in /sys/kernel/iommu_groups/*/devices/*; do
    n=\${d#*/iommu_groups/*}; n=\${n%%/*}
    printf 'IOMMU Group %s ' "$n"
    lspci -nns "\${d##*/}"
done
\`\`\`

If your GPU shares an IOMMU group with other devices, you'll need the ACS Override Patch (or a different slot/motherboard).

## Step 3: Load VFIO Modules

\`\`\`bash
# Add modules
echo "vfio
vfio_iommu_type1
vfio_pci
vfio_virqfd" >> /etc/modules

# Blacklist GPU drivers (so host doesn't grab the GPU)
echo "blacklist nouveau
blacklist nvidia
blacklist radeon
blacklist amdgpu" >> /etc/modprobe.d/blacklist.conf

# Apply
update-initramfs -u -k all
reboot
\`\`\`

## Step 4: Find GPU PCI IDs

\`\`\`bash
# Find your GPU
lspci -nn | grep -E "VGA|Audio" | grep -i "nvidia\|amd\|radeon"
# Example output:
# 01:00.0 VGA compatible controller [0300]: NVIDIA Corporation RTX 3090 [10de:2204]
# 01:00.1 Audio device [0403]: NVIDIA Corporation GA102 HD Audio [10de:1aef]
\`\`\`

Note the IDs: \`10de:2204\` and \`10de:1aef\`

## Step 5: Bind GPU to VFIO

\`\`\`bash
# Create VFIO conf
echo "options vfio-pci ids=10de:2204,10de:1aef" > /etc/modprobe.d/vfio.conf

# Update initramfs
update-initramfs -u
reboot
\`\`\`

## Step 6: Verify GPU is Bound to VFIO

\`\`\`bash
lspci -k | grep -A3 "01:00"
# Should show:
# Kernel driver in use: vfio-pci
# NOT: nvidia or nouveau
\`\`\`

## Step 7: Configure VM for GPU Passthrough

In Proxmox UI → VM → Hardware → Add → PCI Device:

- Select your GPU (01:00.0)
- Check: All Functions (includes audio)
- Check: ROM-Bar
- Check: PCI-Express
- Primary GPU: Yes (if no other display adapter)

Or via CLI:

\`\`\`bash
# Add to VM config
echo "hostpci0: 01:00,pcie=1,rombar=1,x-vga=1" >> /etc/pve/qemu-server/VM_ID.conf

# Complete VM config example
nano /etc/pve/qemu-server/200.conf
\`\`\`

\`\`\`ini
name: gpu-vm
memory: 32768
sockets: 1
cores: 16
cpu: host
machine: q35
bios: ovmf        # Required for UEFI + GPU
efidisk0: local-zfs:vm-200-disk-0,efitype=4m
scsi0: local-zfs:vm-200-disk-1,size=200G
net0: virtio=AA:BB:CC:DD:EE:FF,bridge=vmbr0
hostpci0: 01:00,pcie=1,rombar=1,x-vga=1  # GPU
args: -cpu host,hidden=1,hv_vendor_id=NvidiaHack  # Hide VM from NVIDIA driver
\`\`\`

## NVIDIA Driver Notes

NVIDIA drivers detect if they're running in a VM (error 43 in Windows). To fix:

\`\`\`bash
# Add to VM config
args: -cpu host,hidden=1,hv_vendor_id=NvidiaFTW
\`\`\`

## Verifying in the VM

After booting the Windows/Linux VM:

\`\`\`bash
# Linux: verify GPU is visible
nvidia-smi  # Should show GPU name and memory

# Run GPU benchmark
glxgears
nvidia-smi dmon -s u  # Monitor GPU utilization
\`\`\`

## Troubleshooting

\`\`\`bash
# GPU not appearing in VM
dmesg | grep vfio  # Check VFIO bound properly
dmesg | grep "IOMMU group"

# NVIDIA error 43 in Windows
# Add hv_vendor_id to args in VM config

# VM won't start with GPU
# Check IOMMU group — no other devices should share the group
# or use ACS override

# Performance not native
# Ensure CPU type is "host" not "kvm64"
# Enable hugepages for the VM
\`\`\``,
    contentFa: `## مقدمه

GPU Passthrough به شما اجازه می‌دهد یک GPU فیزیکی را مستقیماً به یک VM اختصاص دهید و کارایی نزدیک به بومی بگیرید.

## مرحله ۱: فعال‌سازی IOMMU در GRUB

\`\`\`bash
nano /etc/default/grub

# برای Intel
GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt"

# برای AMD
GRUB_CMDLINE_LINUX_DEFAULT="quiet amd_iommu=on iommu=pt"

update-grub
reboot
\`\`\`

## مرحله ۲: بارگذاری ماژول‌های VFIO

\`\`\`bash
echo "vfio
vfio_iommu_type1
vfio_pci" >> /etc/modules

echo "blacklist nvidia
blacklist nouveau" >> /etc/modprobe.d/blacklist.conf

update-initramfs -u -k all
reboot
\`\`\`

## مرحله ۳: یافتن PCI ID‌های GPU

\`\`\`bash
lspci -nn | grep -E "VGA|Audio" | grep -i nvidia
# مثال: 01:00.0 ... NVIDIA RTX 3090 [10de:2204]
\`\`\`

## مرحله ۴: اتصال GPU به VFIO

\`\`\`bash
echo "options vfio-pci ids=10de:2204,10de:1aef" > /etc/modprobe.d/vfio.conf
update-initramfs -u
reboot
\`\`\`

## مرحله ۵: پیکربندی VM

\`\`\`ini
cpu: host
machine: q35
bios: ovmf
hostpci0: 01:00,pcie=1,rombar=1,x-vga=1
args: -cpu host,hidden=1,hv_vendor_id=NvidiaFTW
\`\`\``,
  },
  'netflow-sflow-traffic-analysis': {
    contentEn: `## Introduction

NetFlow and sFlow are two industry-standard protocols for collecting network traffic statistics. As a junior infrastructure engineer, understanding traffic analysis helps you answer questions like: "Who is consuming all our bandwidth?", "Is there unusual traffic that could indicate a breach?", and "Which applications are most used?" This guide covers both protocols, their differences, and how to deploy a complete traffic analysis stack.

## NetFlow vs sFlow: Core Differences

**NetFlow** (Cisco proprietary, now standardized as IPFIX) works by tracking every TCP/UDP flow — a unique combination of source IP, destination IP, source port, destination port, and protocol. The router/switch caches these flows and exports them as records to a collector.

**sFlow** (RFC 3176) uses statistical sampling — it randomly samples 1 in N packets (e.g., 1 in 512) and exports the raw packet headers. This is more scalable for high-speed links but less precise for small flows.

Key difference: NetFlow gives you exact flow counts but requires CPU on the router. sFlow samples traffic so it scales to 100G+ links without router CPU impact.

## Setting Up a NetFlow Collector with nfdump/nfcapd

\`\`\`bash
# Install nfdump on Ubuntu/Debian
sudo apt install nfdump

# Create directory for flow data
sudo mkdir -p /var/netflow/data
sudo chown netflow:netflow /var/netflow/data

# Start nfcapd (collector daemon) listening on UDP 9995
sudo nfcapd -D -l /var/netflow/data -p 9995 -P /var/run/nfcapd.pid

# Verify it's listening
sudo netstat -ulnp | grep 9995
\`\`\`

Configure a Cisco router to export NetFlow:

\`\`\`
! On Cisco IOS router
interface GigabitEthernet0/0
 ip flow ingress
 ip flow egress

ip flow-export version 9
ip flow-export destination 192.168.1.100 9995
ip flow-export source Loopback0

ip flow-cache timeout active 1
ip flow-cache timeout inactive 15
\`\`\`

## Reading NetFlow Data with nfdump

\`\`\`bash
# List top 10 talkers by bytes in last hour
nfdump -R /var/netflow/data -t "2024-01-15/13:00:00-2024-01-15/14:00:00"   -s srcip/bytes -n 10

# Show all traffic from suspicious IP
nfdump -R /var/netflow/data -t "2024-01-15/13:00:00"   "src ip 10.0.0.100" -o extended

# Find top destination ports (services being accessed)
nfdump -R /var/netflow/data -s dstport/flows -n 20

# Show traffic between two hosts
nfdump -R /var/netflow/data "(src ip 10.0.0.50 and dst ip 8.8.8.8)"
\`\`\`

Output example:
\`\`\`
Date first seen          Duration  Proto   Src IP Addr:Port    Dst IP Addr:Port    Bytes
2024-01-15 13:05:22.450   0.012    TCP    10.0.0.50:54321  ->  172.16.0.5:443    15234
2024-01-15 13:05:22.462   0.001    UDP    10.0.0.50:1024   ->  8.8.8.8:53          82
\`\`\`

## Deploying ntopng for Visual Traffic Analysis

ntopng provides a web dashboard on top of NetFlow/sFlow data:

\`\`\`bash
# Add ntop repository
wget -qO- https://packages.ntop.org/apt-stable/ntop.key | sudo apt-key add -
echo "deb https://packages.ntop.org/apt-stable/22.04/ x64/" | sudo tee /etc/apt/sources.list.d/ntop.list

sudo apt update && sudo apt install ntopng nprobe

# Configure ntopng
sudo nano /etc/ntopng/ntopng.conf
\`\`\`

\`\`\`
# ntopng.conf
--interface=eth0          # Interface to monitor (or use nprobe for NetFlow)
--http-port=3000
--redis=127.0.0.1
--data-dir=/var/lib/ntopng
--user=ntopng
\`\`\`

\`\`\`bash
sudo systemctl enable ntopng && sudo systemctl start ntopng
# Access at http://your-server:3000 (admin/admin default)
\`\`\`

## sFlow Configuration and Collection

Configure sFlow on a Linux server using Host sFlow agent:

\`\`\`bash
# Install hsflowd
sudo apt install hsflowd

# Configure /etc/hsflowd.conf
sudo cat > /etc/hsflowd.conf << 'CONF'
sflow {
  sampling = 512           # Sample 1 in 512 packets
  polling = 30             # Poll counters every 30 seconds
  agentIP = 192.168.1.10   # This server's IP to identify in collector
  DNSSD = off

  collector {
    ip = 192.168.1.100     # Collector IP
    udpport = 6343         # sFlow port
  }

  pcap { dev = eth0 }
}
CONF

sudo systemctl enable hsflowd && sudo systemctl start hsflowd
\`\`\`

## Building a Full Stack with ELK + Logstash

\`\`\`
# logstash pipeline for NetFlow
input {
  udp {
    port  => 9996
    codec => netflow {
      versions => [5, 9]
    }
  }
}

filter {
  mutate {
    add_field => { "[@metadata][index]" => "netflow" }
  }

  geoip {
    source => "[netflow][ipv4_src_addr]"
    target => "src_geo"
  }

  geoip {
    source => "[netflow][ipv4_dst_addr]"
    target => "dst_geo"
  }
}

output {
  elasticsearch {
    hosts => ["http://localhost:9200"]
    index => "netflow-%{+YYYY.MM.dd}"
  }
}
\`\`\`

## Detecting Anomalies in Traffic Data

Common patterns to look for:

\`\`\`bash
# Detect port scans: one source hitting many destination ports
nfdump -R /var/netflow/data -t "2024-01-15/13:00:00-14:00:00"   -s srcip/flows -n 100 |   awk '$4 > 1000 {print "POSSIBLE SCAN:", $0}'

# Detect data exfiltration: high bytes to external IPs
nfdump -R /var/netflow/data "bytes > 100000000 and not (dst net 10.0.0.0/8)"   -o "fmt: %ts %sa %da %byt %fl"

# Find DNS amplification (large DNS responses)
nfdump -R /var/netflow/data "proto udp and src port 53 and bytes > 512" -s dstip/bytes
\`\`\`

## Grafana Dashboard for Traffic Visualization

\`\`\`yaml
# docker-compose.yml for traffic analysis stack
version: '3.8'
services:
  influxdb:
    image: influxdb:2.7
    ports: ["8086:8086"]
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: password123
      DOCKER_INFLUXDB_INIT_ORG: myorg
      DOCKER_INFLUXDB_INIT_BUCKET: netflow

  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
    depends_on: [influxdb]

  pmacct:
    image: pmacct/pmacctd:latest
    network_mode: host
    volumes:
      - ./pmacctd.conf:/etc/pmacct/pmacctd.conf
\`\`\`

## Capacity Planning with Traffic Data

\`\`\`python
#!/usr/bin/env python3
# analyze_traffic.py - Parse nfdump output for capacity planning
import subprocess
import datetime

def get_hourly_traffic(date_str, interface_net="10.0.0.0/8"):
    '''Get hourly traffic summary for capacity planning.'''
    results = []
    for hour in range(24):
        start = f"{date_str}/{hour:02d}:00:00"
        end = f"{date_str}/{hour:02d}:59:59"

        cmd = [
            "nfdump", "-R", "/var/netflow/data",
            "-t", f"{start}-{end}",
            f"net {interface_net}",
            "-o", "csv", "-q"
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        total_bytes = sum(
            int(line.split(',')[13])
            for line in result.stdout.splitlines()[1:]
            if line and not line.startswith('#')
        )
        results.append({'hour': hour, 'bytes': total_bytes,
                        'mbps': total_bytes * 8 / 3600 / 1_000_000})

    return results

if __name__ == "__main__":
    data = get_hourly_traffic("2024-01-15")
    peak = max(data, key=lambda x: x['mbps'])
    print(f"Peak traffic: {peak['mbps']:.1f} Mbps at {peak['hour']:02d}:00")
    print(f"Recommendation: provision at least {peak['mbps'] * 1.5:.0f} Mbps")
\`\`\`

## Troubleshooting Common Issues

**Flows not arriving at collector:**
\`\`\`bash
# Check if router is sending (packet capture)
sudo tcpdump -i eth0 udp port 9995 -n

# Verify nfcapd is running and writing files
ls -la /var/netflow/data/
tail -f /var/log/syslog | grep nfcapd
\`\`\`

**Missing flows (flow cache full):**
\`\`\`
! Cisco: reduce cache timeout
ip flow-cache timeout active 1    # export active flows every 1 minute
ip flow-cache timeout inactive 5  # expire idle flows after 5 seconds
ip flow-cache entries 65536       # increase cache size
\`\`\`

**High CPU on router due to NetFlow:**
\`\`\`
! Disable NetFlow on internal interfaces, only monitor edge
interface GigabitEthernet0/0.100
 no ip flow ingress   ! Internal VLAN - remove flow monitoring
\`\`\`

Traffic analysis is one of the most powerful tools in a network engineer's toolkit. Start with basic nfdump queries to understand traffic patterns, then graduate to visual tools like ntopng or Grafana dashboards for ongoing monitoring.
`,
    contentFa: `## مقدمه

NetFlow و sFlow دو پروتکل استاندارد صنعتی برای جمع‌آوری آمار ترافیک شبکه هستند. به عنوان یک مهندس زیرساخت تازه‌کار، درک تحلیل ترافیک به شما کمک می‌کند سوالاتی مثل "چه کسی پهنای باند را مصرف می‌کند؟"، "آیا ترافیک غیرعادی‌ای وجود دارد؟" و "کدام اپلیکیشن‌ها بیشتر استفاده می‌شوند؟" را پاسخ دهید. این راهنما هر دو پروتکل، تفاوت‌هایشان و نحوه استقرار یک stack کامل تحلیل ترافیک را پوشش می‌دهد.

## تفاوت اصلی NetFlow و sFlow

**NetFlow** (اختصاصی سیسکو، اکنون به عنوان IPFIX استاندارد شده) با ردیابی هر flow TCP/UDP کار می‌کند - ترکیب منحصربه‌فردی از IP مبدا، IP مقصد، پورت مبدا، پورت مقصد و پروتکل. روتر/سوئیچ این flowها را cache می‌کند و به عنوان رکورد به یک collector صادر می‌کند.

**sFlow** (RFC 3176) از نمونه‌برداری آماری استفاده می‌کند - به طور تصادفی 1 از N بسته (مثلاً 1 از 512) را نمونه‌برداری کرده و هدرهای بسته خام را صادر می‌کند. این برای لینک‌های پرسرعت مقیاس‌پذیرتر است.

## راه‌اندازی NetFlow Collector با nfdump/nfcapd

\`\`\`bash
sudo apt install nfdump
sudo mkdir -p /var/netflow/data

# شروع collector روی UDP 9995
sudo nfcapd -D -l /var/netflow/data -p 9995

# پیکربندی روتر سیسکو
! interface GigabitEthernet0/0
!  ip flow ingress
!  ip flow egress
! ip flow-export version 9
! ip flow-export destination 192.168.1.100 9995
\`\`\`

## خواندن داده‌های NetFlow

\`\`\`bash
# ۱۰ مصرف‌کننده برتر بر اساس بایت
nfdump -R /var/netflow/data -s srcip/bytes -n 10

# ترافیک از IP مشکوک
nfdump -R /var/netflow/data "src ip 10.0.0.100" -o extended

# پورت‌های مقصد پرکاربرد
nfdump -R /var/netflow/data -s dstport/flows -n 20
\`\`\`

## تشخیص ناهنجاری‌ها

\`\`\`bash
# تشخیص پورت اسکن
nfdump -R /var/netflow/data -s srcip/flows -n 100 |   awk '$4 > 1000 {print "SCAN مشکوک:", $0}'

# تشخیص exfiltration داده
nfdump -R /var/netflow/data   "bytes > 100000000 and not (dst net 10.0.0.0/8)"   -o "fmt: %ts %sa %da %byt"
\`\`\`

تحلیل ترافیک یکی از قدرتمندترین ابزارهای یک مهندس شبکه است. با query های ساده nfdump شروع کنید و تدریجاً به ابزارهای بصری مثل ntopng یا داشبورد Grafana برای پایش مستمر ارتقا دهید.
`,
  },
  'alertmanager-routing-rules': {
    contentEn: `## Introduction

Alertmanager is the component in the Prometheus ecosystem that handles alert routing, grouping, silencing, and notification delivery. Without proper Alertmanager configuration, you'll either get alert storms (thousands of redundant notifications) or miss critical alerts entirely. This guide teaches you how to design robust alert routing rules for real-world infrastructure.

## Understanding the Alert Pipeline

When Prometheus evaluates an alerting rule and finds it firing, it sends the alert to Alertmanager. Alertmanager then:
1. **Groups** similar alerts (prevent alert storms)
2. **Routes** the alert to the right receiver (who gets notified?)
3. **Deduplicates** alerts that arrive multiple times
4. **Silences** alerts during maintenance windows
5. **Inhibits** alerts when higher-priority alerts are firing

## Basic Alertmanager Configuration

\`\`\`yaml
# /etc/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@company.com'
  smtp_auth_username: 'alerts@company.com'
  smtp_auth_password: 'app-password-here'
  slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'

route:
  # Default receiver if no route matches
  receiver: 'team-ops-email'

  # Group alerts by these labels
  group_by: ['alertname', 'cluster', 'service']

  # Wait this long before sending first notification (collect related alerts)
  group_wait: 30s

  # Wait this long before sending next notification for same group
  group_interval: 5m

  # Wait this long before re-sending a resolved/continuing alert
  repeat_interval: 4h

  routes:
    # Critical alerts go to PagerDuty immediately
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      group_wait: 10s
      repeat_interval: 1h
      continue: true   # Also send to other matching routes

    # Database alerts go to DBA team
    - match_re:
        alertname: '(MySQL|Postgres|Redis).*'
      receiver: 'team-dba-slack'

    # Security alerts route to security team
    - match:
        team: security
      receiver: 'team-security-email'
      group_by: ['alertname']

receivers:
  - name: 'team-ops-email'
    email_configs:
      - to: 'ops-team@company.com'
        subject: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
        html: '{{ template "email.default.html" . }}'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: 'YOUR_PAGERDUTY_INTEGRATION_KEY'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'

  - name: 'team-dba-slack'
    slack_configs:
      - channel: '#database-alerts'
        title: '{{ .Status | toUpper }}: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'

inhibit_rules:
  # If a node is down, suppress all other alerts from that node
  - source_match:
      alertname: NodeDown
    target_match_re:
      alertname: '.*'
    equal: ['instance']
\`\`\`

## Advanced Routing with Multiple Conditions

\`\`\`yaml
route:
  receiver: 'blackhole'  # Default: drop (alerts must match a route)
  routes:
    # Business hours vs after-hours routing
    - match:
        severity: warning
      routes:
        - match:
            # Only during business hours (complex: use time_intervals)
            business_hours: 'true'
          receiver: 'slack-warnings'
        - receiver: 'pagerduty-warnings'  # After hours: page someone

    # Multi-condition matching
    - match:
        severity: critical
        environment: production
      receiver: 'pagerduty-prod-critical'

    - match:
        severity: critical
        environment: staging
      receiver: 'slack-staging-critical'

    # Namespace-based routing in Kubernetes
    - match_re:
        namespace: 'kube-system|monitoring'
      receiver: 'team-platform-slack'

    - match_re:
        namespace: 'app-.*'
      receiver: 'team-dev-slack'
\`\`\`

## Time-Based Routing (Business Hours)

\`\`\`yaml
# alertmanager.yml with time intervals
time_intervals:
  - name: business-hours
    time_intervals:
      - times:
          - start_time: '08:00'
            end_time: '18:00'
        weekdays: ['monday:friday']
        location: 'America/New_York'

  - name: weekends
    time_intervals:
      - weekdays: ['saturday', 'sunday']

route:
  routes:
    - match:
        severity: warning
      routes:
        - active_time_intervals:
            - business-hours
          receiver: 'slack-channel'
        - mute_time_intervals:
            - business-hours
          receiver: 'pagerduty'  # Only page outside business hours
\`\`\`

## Creating Effective Alert Templates

\`\`\`yaml
# templates/slack.tmpl
{{ define "slack.title" }}
[{{ .Status | toUpper }}{{ if eq .Status "firing" }} :fire:{{ else }} :white_check_mark:{{ end }}]
{{ .GroupLabels.alertname }} ({{ .Alerts | len }} alert{{ if gt (len .Alerts) 1 }}s{{ end }})
{{ end }}

{{ define "slack.text" }}
{{ range .Alerts }}
*Alert:* {{ .Annotations.summary }}
*Severity:* {{ .Labels.severity }}
*Instance:* {{ .Labels.instance }}
*Description:* {{ .Annotations.description }}
*Started:* {{ .StartsAt | since }}
---
{{ end }}
{{ end }}
\`\`\`

\`\`\`yaml
# Reference template in receiver config
receivers:
  - name: 'slack-ops'
    slack_configs:
      - channel: '#ops-alerts'
        title: '{{ template "slack.title" . }}'
        text: '{{ template "slack.text" . }}'
\`\`\`

## Silencing Alerts During Maintenance

\`\`\`bash
# Using amtool CLI to create silences
amtool --alertmanager.url=http://localhost:9093 silence add   --author="ops-engineer"   --comment="Planned maintenance window"   --duration=2h   alertname="NodeDown" instance="web-01.company.com"

# Silence by regex
amtool silence add   --author="jenkins-deploy"   --comment="Deployment in progress"   --duration=30m   'namespace=~"production"' 'severity=~"warning|critical"'

# List active silences
amtool silence query

# Expire a silence early
amtool silence expire <silence-id>
\`\`\`

## Inhibition Rules Deep Dive

\`\`\`yaml
inhibit_rules:
  # If the whole cluster is down, suppress individual node alerts
  - source_match:
      alertname: ClusterDown
    target_match_re:
      alertname: '(NodeDown|PodCrashLooping|ServiceUnavailable)'
    equal: ['cluster']

  # If disk is full, suppress high disk usage warnings (redundant)
  - source_match:
      alertname: DiskFull
    target_match:
      alertname: DiskUsageHigh
    equal: ['instance', 'mountpoint']

  # If a node's NIC is down, suppress high latency alerts
  - source_match:
      alertname: NetworkInterfaceDown
    target_match_re:
      alertname: 'HighLatency.*'
    equal: ['instance']
\`\`\`

## Testing Your Configuration

\`\`\`bash
# Validate config file syntax
alertmanager --config.file=/etc/alertmanager/alertmanager.yml --check-config

# Test with amtool
amtool --alertmanager.url=http://localhost:9093 config routes test   --verify.receivers=pagerduty-critical   severity=critical environment=production

# Send a test alert via API
curl -X POST http://localhost:9093/api/v2/alerts   -H 'Content-Type: application/json'   -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "critical",
      "environment": "staging"
    },
    "annotations": {
      "summary": "Test alert for routing verification",
      "description": "This is a test"
    },
    "generatorURL": "http://localhost:9090"
  }]'
\`\`\`

## High Availability Alertmanager Setup

\`\`\`yaml
# docker-compose for HA Alertmanager cluster
version: '3.8'
services:
  alertmanager-1:
    image: prom/alertmanager:latest
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--cluster.listen-address=0.0.0.0:9094'
      - '--cluster.peer=alertmanager-2:9094'
      - '--cluster.peer=alertmanager-3:9094'
    ports: ["9093:9093", "9094:9094"]
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

  alertmanager-2:
    image: prom/alertmanager:latest
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--cluster.listen-address=0.0.0.0:9094'
      - '--cluster.peer=alertmanager-1:9094'
      - '--cluster.peer=alertmanager-3:9094'
    ports: ["9095:9093", "9096:9094"]
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
\`\`\`

\`\`\`yaml
# Prometheus should point to all Alertmanager instances
# prometheus.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - 'alertmanager-1:9093'
          - 'alertmanager-2:9093'
          - 'alertmanager-3:9093'
\`\`\`

Proper Alertmanager configuration is the difference between an oncall team that responds to real incidents and one that is drowning in noise. Start with simple routing, add inhibition to reduce redundancy, and use time-based routing to respect your team's working hours.
`,
    contentFa: `## مقدمه

Alertmanager مؤلفه‌ای در اکوسیستم Prometheus است که routing هشدار، گروه‌بندی، silence کردن و ارسال اعلان را مدیریت می‌کند. بدون پیکربندی مناسب، یا با طوفان هشدار (هزاران اعلان تکراری) مواجه می‌شوید یا هشدارهای حیاتی را از دست می‌دهید. این راهنما نحوه طراحی قوانین routing هشدار را برای زیرساخت واقعی آموزش می‌دهد.

## پیپ‌لاین هشدار

وقتی Prometheus یک قانون هشداردهی را ارزیابی می‌کند و آن را در حال fire می‌بیند، هشدار را به Alertmanager ارسال می‌کند:
۱. **گروه‌بندی** هشدارهای مشابه
۲. **Routing** هشدار به receiver مناسب
۳. **Deduplication** هشدارهای تکراری
۴. **Silence** هشدارها در پنجره‌های تعمیراتی
۵. **Inhibition** هشدارها هنگامی که هشدارهای با اولویت بالاتر در حال fire هستند

## پیکربندی پایه Alertmanager

\`\`\`yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@company.com'

route:
  receiver: 'team-ops-email'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      group_wait: 10s

    - match_re:
        alertname: '(MySQL|Postgres).*'
      receiver: 'team-dba-slack'
\`\`\`

## Inhibition Rules

\`\`\`yaml
inhibit_rules:
  # اگر node down است، هشدارهای دیگر همان node را suppress کن
  - source_match:
      alertname: NodeDown
    target_match_re:
      alertname: '.*'
    equal: ['instance']

  # اگر دیسک پر است، هشدار استفاده بالا را suppress کن
  - source_match:
      alertname: DiskFull
    target_match:
      alertname: DiskUsageHigh
    equal: ['instance', 'mountpoint']
\`\`\`

## تست پیکربندی

\`\`\`bash
# اعتبارسنجی فایل config
alertmanager --config.file=alertmanager.yml --check-config

# ارسال هشدار تست
curl -X POST http://localhost:9093/api/v2/alerts   -H 'Content-Type: application/json'   -d '[{"labels":{"alertname":"Test","severity":"critical"}}]'

# ایجاد silence برای تعمیرات
amtool silence add --author="ops" --duration=2h   alertname="NodeDown" instance="web-01.company.com"
\`\`\`

پیکربندی صحیح Alertmanager تفاوت میان تیمی است که به حوادث واقعی پاسخ می‌دهد و تیمی که در سیل اعلان غرق شده است. از routing ساده شروع کنید، inhibition برای کاهش تکرار اضافه کنید، و routing زمان‌محور برای احترام به ساعت کاری تیمتان استفاده کنید.
`,
  },
  'uptime-kuma-monitoring': {
    contentEn: `## Introduction

Uptime Kuma is a self-hosted monitoring tool that tracks the availability of websites, APIs, TCP ports, DNS records, and more. It's the modern open-source alternative to services like UptimeRobot, featuring a clean dashboard, SSL certificate monitoring, and multi-channel notifications. This guide teaches you how to deploy and configure it for production infrastructure monitoring.

## Why Uptime Kuma Over Commercial Services?

- **Privacy**: All data stays on your servers, no third-party data sharing
- **Cost**: Free vs $20-100/month for commercial alternatives
- **Customization**: Configure any check type, any interval
- **Integrations**: 90+ notification channels (Slack, Telegram, PagerDuty, webhooks)
- **Status Pages**: Build public/private status pages for your services

## Deploying with Docker

\`\`\`bash
# Simple single-container deployment
docker run -d   --name uptime-kuma   --restart unless-stopped   -p 3001:3001   -v uptime-kuma:/app/data   louislam/uptime-kuma:1

# Access at http://your-server:3001
# Create admin account on first visit
\`\`\`

Docker Compose for production:

\`\`\`yaml
# docker-compose.yml
version: '3.8'
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Tehran
    healthcheck:
      test: ["CMD", "node", "/app/extra/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: nginx reverse proxy with SSL
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - uptime-kuma
\`\`\`

Nginx configuration for SSL termination:

\`\`\`nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name status.company.com;

    ssl_certificate /etc/ssl/certs/company.crt;
    ssl_certificate_key /etc/ssl/certs/company.key;

    location / {
        proxy_pass http://uptime-kuma:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;

        # Required for WebSocket (Uptime Kuma uses WS for real-time updates)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
\`\`\`

## Monitor Types and Configuration

**HTTP/HTTPS Monitor:**
- URL: \`https://app.company.com/api/health\`
- Method: GET or POST
- Expected status: 200
- Keywords to check in response: \`"status":"ok"\`
- Check interval: 60 seconds
- Timeout: 30 seconds

**TCP Port Monitor:**
- Use for: databases (5432), SMTP (25), custom apps
- Host: \`db.company.com\`
- Port: \`5432\`
- Interval: 60s

**DNS Monitor:**
- Check if DNS resolves correctly
- Hostname: \`app.company.com\`
- Expected value: \`203.0.113.10\`
- DNS resolver: \`8.8.8.8\`

**SSL Certificate Monitor:**
- Monitors certificate expiry
- URL: \`https://app.company.com\`
- Alert when cert expires in < 14 days

**Docker Container Monitor:**
- Connect Uptime Kuma to Docker socket to monitor container health
- Container name: \`web-app\`
- Checks Docker health status

## Setting Up Notifications

\`\`\`
# Telegram Notification Setup:
1. Create a bot via @BotFather → get TOKEN
2. Send a message to your bot, then visit:
   https://api.telegram.org/bot<TOKEN>/getUpdates
3. Find your chat_id in the response
4. In Uptime Kuma: Settings → Notifications → Add → Telegram
   Bot Token: 123456:ABC...
   Chat ID: -100123456789 (negative = group)
\`\`\`

Webhook notification for custom integrations:

\`\`\`yaml
# Uptime Kuma sends JSON payload to your webhook URL:
{
  "heartbeat": {
    "monitorID": 1,
    "status": 0,       # 0=down, 1=up
    "time": "2024-01-15T10:30:00.000Z",
    "msg": "Connection refused",
    "ping": 0,
    "duration": 0
  },
  "monitor": {
    "id": 1,
    "name": "Production API",
    "url": "https://api.company.com/health",
    "type": "http",
    "active": true
  },
  "msg": "Production API is down - Connection refused"
}
\`\`\`

## Status Pages

\`\`\`
# Creating a public status page:
1. Uptime Kuma → Status Pages → New Status Page
2. Configure:
   - Slug: "status" (accessible at /status/status)
   - Title: "Company Services Status"
   - Description: "Real-time status of our infrastructure"
   - Logo URL: https://company.com/logo.png
3. Add monitors to display (can group them):
   Group: "Web Services"
     - Production Website
     - API Endpoint
   Group: "Backend"
     - Database
     - Cache (Redis)
4. Toggle "Public" to make it accessible without login
\`\`\`

## Uptime Kuma API for Automation

\`\`\`python
#!/usr/bin/env python3
# uptime_kuma_api.py - Automate monitor management
from uptime_kuma_api import UptimeKumaApi, MonitorType

api = UptimeKumaApi("http://localhost:3001")
api.login("admin", "your-password")

# Add a new HTTP monitor
monitor = api.add_monitor(
    type=MonitorType.HTTP,
    name="New Microservice",
    url="https://microservice.internal/health",
    interval=60,
    retryInterval=30,
    maxretries=3,
    notificationIDList=[1, 2],  # Notification IDs to use
    keyword="healthy",          # Check for this keyword in response
    timeout=30,
)
print(f"Created monitor: {monitor['monitorID']}")

# List all monitors and their status
monitors = api.get_monitors()
for m in monitors:
    status = "UP" if m.get('active') else "PAUSED"
    print(f"{m['name']}: {status}")

# Pause a monitor during maintenance
api.pause_monitor(monitor_id=5)

# Resume after maintenance
api.resume_monitor(monitor_id=5)

api.disconnect()
\`\`\`

## Backup and Restore

\`\`\`bash
# Backup: just copy the data directory
docker stop uptime-kuma
tar czf uptime-kuma-backup-$(date +%Y%m%d).tar.gz ./data/
docker start uptime-kuma

# Restore:
docker stop uptime-kuma
tar xzf uptime-kuma-backup-20240115.tar.gz
docker start uptime-kuma

# Automated backup with cron
# /etc/cron.daily/backup-uptime-kuma
#!/bin/bash
cd /opt/uptime-kuma
docker stop uptime-kuma
tar czf /backup/uptime-kuma-$(date +%Y%m%d).tar.gz ./data/
docker start uptime-kuma
find /backup -name "uptime-kuma-*.tar.gz" -mtime +30 -delete
\`\`\`

## Alerting Best Practices

Configure monitors with appropriate sensitivity:
- **Critical services** (public website, payment API): interval=30s, maxretries=1
- **Internal services**: interval=60s, maxretries=3
- **Background jobs**: interval=300s, maxretries=5

Use heartbeat monitors for cron jobs:
\`\`\`bash
# In your cron job, send a ping to Uptime Kuma after success
*/5 * * * * /opt/scripts/backup.sh &&   curl -s "https://uptime.company.com/api/push/AbCdEfGh1234?status=up&msg=OK&ping=0"
\`\`\`

Uptime Kuma transforms reactive firefighting into proactive monitoring. With proper setup, you'll know about outages before your users do, and have historical uptime data to back up your SLA reports.
`,
    contentFa: `## مقدمه

Uptime Kuma یک ابزار پایش self-hosted است که در دسترس بودن وب‌سایت‌ها، APIها، پورت‌های TCP، رکوردهای DNS و موارد دیگر را ردیابی می‌کند. این جایگزین مدرن open-source برای سرویس‌هایی مثل UptimeRobot است که داشبورد تمیز، پایش گواهی SSL و اعلان‌های چندکاناله دارد.

## استقرار با Docker

\`\`\`bash
# استقرار ساده تک‌کانتینری
docker run -d   --name uptime-kuma   --restart unless-stopped   -p 3001:3001   -v uptime-kuma:/app/data   louislam/uptime-kuma:1

# دسترسی: http://your-server:3001
\`\`\`

## انواع Monitor

- **HTTP/HTTPS**: بررسی در دسترس بودن وب‌سایت و API
- **TCP Port**: برای دیتابیس‌ها، SMTP، اپلیکیشن‌های سفارشی
- **DNS**: بررسی صحت resolve DNS
- **SSL Certificate**: هشدار انقضای گواهی
- **Docker Container**: بررسی health container

## تنظیم اعلان‌ها (Telegram)

\`\`\`
۱. ربات بسازید از @BotFather و TOKEN دریافت کنید
۲. chat_id خود را از API دریافت کنید:
   https://api.telegram.org/bot<TOKEN>/getUpdates
۳. در Uptime Kuma: Settings → Notifications → Telegram
   Bot Token و Chat ID را وارد کنید
\`\`\`

## صفحه وضعیت عمومی

\`\`\`
۱. Status Pages → New Status Page
۲. Slug، عنوان و توضیحات را تنظیم کنید
۳. Monitor ها را گروه‌بندی کنید
۴. Public کنید برای دسترسی عمومی
\`\`\`

## پشتیبان‌گیری

\`\`\`bash
# فقط کافی است پوشه data را کپی کنید
docker stop uptime-kuma
tar czf backup-$(date +%Y%m%d).tar.gz ./data/
docker start uptime-kuma
\`\`\`

Uptime Kuma پایش زیرساخت را از واکنشی به فعالانه تبدیل می‌کند. با تنظیم صحیح، قبل از کاربرانتان از خرابی‌ها مطلع خواهید شد.
`,
  },
  'grafana-loki-log-aggregation': {
    contentEn: `## Introduction

Grafana Loki is a horizontally scalable, highly available log aggregation system inspired by Prometheus. Unlike Elasticsearch which indexes the full content of logs, Loki only indexes metadata (labels) and stores log content compressed. This makes Loki much more cost-effective while still enabling powerful queries via LogQL. This guide teaches you to build a complete log aggregation stack: Promtail (collector) → Loki (storage) → Grafana (visualization).

## The PLG Stack Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Your Infrastructure                   │
│                                                          │
│  [App Server]      [Web Server]      [Database]          │
│  /var/log/*.log    /var/log/nginx/   /var/log/postgres/  │
│       │                 │                  │             │
│  [Promtail]        [Promtail]         [Promtail]         │
└────────────────────┼──────────────────────┘             │
                     │ HTTP/gRPC push                      │
                     ▼                                     │
              ┌─────────────┐                              │
              │    Loki      │  ← Stores compressed logs   │
              └──────┬──────┘                              │
                     │ Query (LogQL)                       │
                     ▼                                     │
              ┌─────────────┐                              │
              │   Grafana    │  ← Dashboard & Alerting     │
              └─────────────┘                              │
\`\`\`

## Deploying the PLG Stack with Docker Compose

\`\`\`yaml
# docker-compose.yml
version: '3.8'

services:
  loki:
    image: grafana/loki:2.9.4
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./loki-config.yaml:/etc/loki/local-config.yaml
      - loki-data:/loki
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:2.9.4
    volumes:
      - /var/log:/var/log:ro           # Host log files (read-only)
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yaml:/etc/promtail/config.yaml
    command: -config.file=/etc/promtail/config.yaml
    networks:
      - monitoring
    depends_on:
      - loki

  grafana:
    image: grafana/grafana:10.2.3
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana-datasource.yaml:/etc/grafana/provisioning/datasources/loki.yaml
    networks:
      - monitoring
    depends_on:
      - loki

volumes:
  loki-data:
  grafana-data:

networks:
  monitoring:
    driver: bridge
\`\`\`

## Loki Configuration

\`\`\`yaml
# loki-config.yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093

# Retention: keep logs for 30 days
limits_config:
  retention_period: 720h  # 30 days
  ingestion_rate_mb: 16
  ingestion_burst_size_mb: 32
\`\`\`

## Promtail Configuration

\`\`\`yaml
# promtail-config.yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml   # Tracks file read position

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Collect nginx access logs
  - job_name: nginx
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx
          host: web-01
          __path__: /var/log/nginx/*.log
    pipeline_stages:
      - regex:
          expression: '^(?P<remote_addr>\S+) - (?P<remote_user>\S+) \[(?P<time_local>[^\]]+)\] "(?P<method>\S+) (?P<request>\S+) (?P<protocol>[^"]+)" (?P<status>\d+) (?P<body_bytes_sent>\d+)'
      - labels:
          method:
          status:
      - drop:
          expression: ".*GET /health.*"  # Drop health check noise

  # Collect systemd journal logs
  - job_name: systemd-journal
    journal:
      max_age: 12h
      labels:
        job: systemd-journal
        host: web-01
    relabel_configs:
      - source_labels: ['__journal__systemd_unit']
        target_label: 'unit'

  # Collect Docker container logs
  - job_name: docker-containers
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/?(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: 'service'
\`\`\`

## Grafana Data Source Configuration

\`\`\`yaml
# grafana-datasource.yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    jsonData:
      maxLines: 1000
      derivedFields:
        # Auto-link trace IDs to Jaeger
        - datasourceUid: jaeger
          matcherRegex: "traceID=(\w+)"
          name: TraceID
          url: '$\${__value.raw}'
\`\`\`

## LogQL Query Language

LogQL is Loki's query language, similar to PromQL but for logs:

\`\`\`logql
# Basic log stream selector
{job="nginx", status="500"}

# Filter by regex
{job="nginx"} |= "error" != "health"

# Parse and filter structured JSON logs
{job="app-api"} | json | level="error" | duration > 200ms

# Count errors per minute (metric query)
sum by (status) (
  rate({job="nginx"}[1m])
)

# Top 5 slowest API endpoints
topk(5,
  sum by (request) (
    rate({job="nginx"} | logfmt | duration > 0 [5m])
  )
)

# Find all 5xx errors in production
{job=~"nginx|apache", environment="production"} |= "5" | regexp "HTTP/[0-9.]+ [5][0-9][0-9]"

# Calculate error rate
sum(rate({job="api", level="error"}[5m]))
/
sum(rate({job="api"}[5m]))
\`\`\`

## Creating Grafana Dashboards for Logs

\`\`\`json
// Example Grafana panel configuration (JSON)
{
  "type": "logs",
  "title": "Application Error Logs",
  "datasource": "Loki",
  "targets": [
    {
      "expr": "{job="app-api", level="error"} | json",
      "legendFormat": "",
      "refId": "A"
    }
  ],
  "options": {
    "dedupStrategy": "signature",
    "showLabels": false,
    "showTime": true,
    "sortOrder": "Descending",
    "wrapLogMessage": true
  }
}
\`\`\`

## Setting Up Loki Alert Rules

\`\`\`yaml
# loki-rules.yaml
groups:
  - name: application-alerts
    rules:
      # Alert when error rate exceeds 5%
      - alert: HighErrorRate
        expr: |
          sum(rate({job="api", level="error"}[5m]))
          /
          sum(rate({job="api"}[5m])) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in API"
          description: "Error rate is {{ $value | humanizePercentage }} over last 5 minutes"

      # Alert on authentication failures
      - alert: AuthenticationFailures
        expr: |
          sum(rate({job="app"} |= "authentication failed" [5m])) > 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Multiple authentication failures detected"
\`\`\`

## Scaling Loki for Production

\`\`\`yaml
# loki-config.yaml for distributed mode
# Use S3/GCS instead of filesystem for storage
common:
  storage:
    s3:
      endpoint: s3.amazonaws.com
      region: us-east-1
      bucketnames: my-loki-bucket
      access_key_id: \${S3_ACCESS_KEY}
      secret_access_key: \${S3_SECRET_KEY}
      s3forcepathstyle: false

# Separate components for horizontal scaling
# Run as: loki -target=ingester / loki -target=querier / loki -target=distributor
\`\`\`

Loki's label-based approach keeps storage costs low while maintaining query speed. The key insight is that Loki shines when you already know what you're looking for — use Grafana dashboards for operational visibility and LogQL for ad-hoc investigation during incidents.
`,
    contentFa: `## مقدمه

Grafana Loki یک سیستم جمع‌آوری لاگ مقیاس‌پذیر افقی است که از Prometheus الهام گرفته. برخلاف Elasticsearch که محتوای کامل لاگ‌ها را ایندکس می‌کند، Loki فقط متادیتا (labels) را ایندکس کرده و محتوای لاگ را فشرده ذخیره می‌کند. این باعث می‌شود Loki از نظر هزینه بسیار مقرون‌به‌صرفه‌تر باشد.

## معماری Stack PLG

\`\`\`
[سرورها] → [Promtail] → [Loki] → [Grafana]
\`\`\`

## استقرار با Docker Compose

\`\`\`yaml
version: '3.8'
services:
  loki:
    image: grafana/loki:2.9.4
    ports: ["3100:3100"]
    volumes:
      - ./loki-config.yaml:/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:2.9.4
    volumes:
      - /var/log:/var/log:ro
      - ./promtail-config.yaml:/etc/promtail/config.yaml

  grafana:
    image: grafana/grafana:10.2.3
    ports: ["3000:3000"]
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure-password
\`\`\`

## پیکربندی Promtail

\`\`\`yaml
clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: nginx
    static_configs:
      - targets: [localhost]
        labels:
          job: nginx
          __path__: /var/log/nginx/*.log
\`\`\`

## زبان Query لوکی (LogQL)

\`\`\`logql
# لاگ‌های خطا از nginx
{job="nginx"} |= "error" != "health"

# تعداد خطا در دقیقه
sum by (status) (rate({job="nginx"}[1m]))

# لاگ‌های JSON parse شده
{job="api"} | json | level="error" | duration > 200ms
\`\`\`

## قوانین هشداردهی

\`\`\`yaml
groups:
  - name: application-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate({job="api", level="error"}[5m]))
          / sum(rate({job="api"}[5m])) > 0.05
        for: 2m
        labels:
          severity: warning
\`\`\`

رویکرد label-محور Loki هزینه ذخیره‌سازی را پایین نگه می‌دارد. برای دید عملیاتی از داشبورد Grafana و برای تحقیق در حوادث از LogQL استفاده کنید.
`,
  },
  'prtg-network-monitoring': {
    contentEn: `## Introduction

PRTG Network Monitor is a comprehensive monitoring solution widely used in enterprise Windows environments. It monitors everything from SNMP-based network devices to Windows performance counters, HTTP endpoints, and custom sensors. As a junior engineer in an environment using PRTG, you need to understand how to add devices, create sensors, set thresholds, and build useful dashboards. This guide covers the real-world PRTG workflows you'll use daily.

## PRTG Architecture Overview

\`\`\`
┌─────────────────────────────────────┐
│          PRTG Core Server           │
│  ┌─────────────────────────────┐    │
│  │    Web Interface (443)      │    │
│  │    REST API                 │    │
│  │    Notification Engine      │    │
│  └─────────────────────────────┘    │
│  ┌──────────┐  ┌──────────────┐     │
│  │  Probe   │  │ Remote Probe │     │
│  │ (local)  │  │ (remote site)│     │
│  └────┬─────┘  └──────┬───────┘     │
└───────┼────────────────┼────────────┘
        │                │
  ┌─────▼──────┐   ┌─────▼──────┐
  │ Local LAN  │   │ Remote LAN │
  │  Devices   │   │  Devices   │
  └────────────┘   └────────────┘
\`\`\`

PRTG uses "probes" — monitoring agents that do the actual polling. The local probe is on the PRTG server itself; remote probes monitor devices at other locations and report back to the core.

## Adding Devices and Auto-Discovery

\`\`\`
# Manual device addition:
1. PRTG Web UI → Devices → Add Device
2. IP Address: 192.168.1.1
3. DNS Name: router.company.com
4. Device Icon: select appropriate type
5. Credentials tab:
   - Windows: DOMAIN\\username + password (for WMI)
   - SNMP: v2c, community string "public" (or your string)
   - SSH: username + key/password (for Linux)
6. Click "OK and Run Auto-Discovery"

# Auto-discovery finds common sensors automatically:
# - Ping
# - SNMP Traffic (all interfaces)
# - SNMP Uptime
# - WMI CPU (Windows)
# - WMI Memory (Windows)
\`\`\`

## Creating Custom SNMP Sensors

\`\`\`python
# Most network devices support SNMP OIDs
# Common OIDs you'll use:

# Interface traffic
# ifInOctets:  1.3.6.1.2.1.2.2.1.10.<ifIndex>
# ifOutOctets: 1.3.6.1.2.1.2.2.1.16.<ifIndex>

# CPU usage on Cisco
# ciscoAvgBusy5: 1.3.6.1.4.1.9.2.1.58.0

# Temperature on Cisco
# ciscoEnvMonTemperatureStatusValue: 1.3.6.1.4.1.9.9.13.1.3.1.3.<index>
\`\`\`

Adding a custom SNMP sensor in PRTG:
\`\`\`
1. Right-click device → Add Sensor
2. Filter: "SNMP Custom"
3. Select "SNMP Custom Integer"
4. Configure:
   OID: 1.3.6.1.4.1.9.2.1.58.0
   Name: Cisco CPU Load 5min
   Unit: %
   Value Type: Absolute value (not counter)
5. Set limits:
   Warning above: 70%
   Error above: 90%
\`\`\`

## Windows Monitoring with WMI Sensors

\`\`\`
# WMI sensors require:
# 1. PRTG service runs as domain account (or local admin)
# 2. Windows Firewall allows WMI (TCP 135 + dynamic ports)
# 3. Target machine: WBEM, DCOM enabled

# Common WMI sensors:
- WMI CPU Load: Shows per-core and total CPU
- WMI Memory: Physical, virtual, page file usage
- WMI Logical Disk: Space used/free, I/O
- WMI Service: Monitor if specific Windows services are running
- WMI Event Log: Alert on specific Windows Event IDs

# Example: Monitor Windows Event ID 4625 (failed logon)
Sensor: WMI Event Log
Log: Security
Event IDs: 4625
Alert when: Count > 10 in 5 minutes → trigger notification
\`\`\`

## HTTP/API Monitoring

\`\`\`
# HTTP sensor types:
- HTTP: Simple up/down check (status code)
- HTTP Advanced: Check response content, JSON values
- REST Custom: Parse JSON/XML API responses

# Example: Monitor API endpoint returning JSON
Sensor: REST Custom (XML/JSON)
URL: https://api.company.com/v1/health
Authentication: Bearer token in headers
JSON Path: $.status
Expected: "healthy"
Interval: 60 seconds

# Check specific JSON value
JSON: {"status": "ok", "latency_ms": 45, "queue_size": 1250}
Monitor latency_ms with:
  Warning above: 200
  Error above: 500
\`\`\`

## Setting Thresholds and Notifications

\`\`\`
# Sensor states in PRTG:
# 0 = OK (green)
# 1 = Warning (yellow)
# 2 = Error (red)
# 3 = Unknown (gray)

# Example: Disk space thresholds
Warning above: 80% used
Error above: 90% used

# For counter-type sensors (traffic bandwidth):
Unit: Mbit/s
Warning above: 800 Mbit/s (80% of 1 Gbit link)
Error above: 950 Mbit/s (95% of 1 Gbit link)
\`\`\`

Notification template (email):
\`\`\`
Subject: [PRTG] {status} - {name} on {host}

Device: {host}
Sensor: {name}
Status: {status}
Value: {lastvalue}
Date/Time: {datetime}

Message: {message}

Link: {url}
\`\`\`

## PRTG REST API for Automation

\`\`\`python
#!/usr/bin/env python3
# prtg_api.py - Automate PRTG tasks
import requests
import urllib3
urllib3.disable_warnings()  # PRTG often uses self-signed cert

PRTG_URL = "https://prtg.company.com"
USERNAME = "api-user"
PASSWORD = "api-password"  # Or use API token

def prtg_get(endpoint, params={}):
    params.update({
        'username': USERNAME,
        'password': PASSWORD,
        'output': 'json'
    })
    resp = requests.get(f"{PRTG_URL}{endpoint}", params=params, verify=False)
    return resp.json()

# Get all sensors in error state
def get_error_sensors():
    data = prtg_get('/api/table.json', {
        'content': 'sensors',
        'columns': 'objid,name,device,status,lastvalue,message',
        'filter_status': 5  # 5=Error
    })
    return data.get('sensors', [])

# Acknowledge alerts programmatically
def acknowledge_sensor(sensor_id, message):
    params = {
        'id': sensor_id,
        'ackmsg': message,
        'username': USERNAME,
        'password': PASSWORD
    }
    resp = requests.get(f"{PRTG_URL}/api/acknowledgealarm.htm",
                       params=params, verify=False)
    return resp.status_code == 200

# Pause a device during maintenance
def pause_device(device_id, duration_minutes=60, message="Maintenance"):
    params = {
        'id': device_id,
        'action': 2,      # 2=pause for duration, 0=resume
        'duration': duration_minutes,
        'pausemsg': message,
        'username': USERNAME,
        'password': PASSWORD
    }
    requests.get(f"{PRTG_URL}/api/pause.htm", params=params, verify=False)

if __name__ == "__main__":
    errors = get_error_sensors()
    print(f"Found {len(errors)} sensors in error state:")
    for s in errors:
        print(f"  {s['device']} - {s['name']}: {s['message']}")
\`\`\`

## Creating Maps and Dashboards

\`\`\`
# PRTG Map Designer:
1. Setup → Maps → Add Map
2. Map name: "Network Overview"
3. Set background: upload floor plan image or use grid

# Add objects to map:
- Drag devices from device tree onto map
- Add "Summary Sensor" tiles (shows group status)
- Add traffic flow arrows between devices
- Add text labels for locations

# Map objects update in real-time:
- Green background = device/sensor OK
- Yellow = warning
- Red = error
- Tooltip shows current values

# Share maps:
- Public map URL (no login required) for NOC screens
- Embed in SharePoint/wiki with iframe
\`\`\`

## PRTG Best Practices

\`\`\`
1. Organize with Groups:
   Root
   ├── Core Infrastructure
   │   ├── Network (routers, switches)
   │   └── Servers (Windows, Linux)
   ├── Applications
   │   ├── Web Servers
   │   └── Databases
   └── Remote Sites
       ├── Branch Office 1
       └── Branch Office 2

2. Use Inheritance for credentials:
   Set SNMP community at Group level → all devices inherit

3. Pause maintenance windows:
   Right-click device → Pause → "Until [date/time]"
   Add comment explaining why

4. Regular cleanup:
   - Remove sensors that are always in "unknown" state
   - Delete devices that no longer exist
   - Check Sensors by Type for orphaned sensors

5. Backup configuration:
   Setup → System Administration → Backup/Restore Config
   Schedule weekly automated backup to network share
\`\`\`

PRTG's strength is its breadth of sensor types and ease of setup in Windows environments. Master the sensor threshold configuration and notification templates first — those skills directly translate to faster incident response times.
`,
    contentFa: `## مقدمه

PRTG Network Monitor یک راه‌حل جامع پایش است که در محیط‌های سازمانی Windows به‌طور گسترده استفاده می‌شود. همه چیز از دستگاه‌های شبکه مبتنی بر SNMP تا performance counter های Windows، endpoint های HTTP و sensor های سفارشی را پایش می‌کند.

## معماری PRTG

PRTG از "probe" استفاده می‌کند — عامل‌هایی که نظرسنجی واقعی را انجام می‌دهند. probe محلی روی سرور PRTG است؛ remote probe ها دستگاه‌های مکان‌های دیگر را پایش می‌کنند.

## افزودن دستگاه‌ها

\`\`\`
۱. Devices → Add Device
۲. آدرس IP و نام DNS
۳. Credentials:
   - Windows: DOMAIN\\username + password
   - SNMP: v2c، community string
   - SSH: برای Linux
۴. اجرای Auto-Discovery
\`\`\`

## Sensor های رایج

- **SNMP Traffic**: ترافیک اینترفیس شبکه
- **WMI CPU/Memory**: معیارهای عملکرد Windows
- **HTTP**: بررسی وب‌سایت و API
- **Ping**: بررسی در دسترس بودن

## API برای اتوماسیون

\`\`\`python
import requests

def prtg_get(endpoint, params={}):
    params.update({'username': 'user', 'password': 'pass', 'output': 'json'})
    return requests.get(f"https://prtg.company.com{endpoint}",
                       params=params, verify=False).json()

# دریافت sensor های در وضعیت خطا
errors = prtg_get('/api/table.json', {
    'content': 'sensors',
    'filter_status': 5  # 5=Error
})
\`\`\`

قدرت PRTG در گستردگی انواع sensor و سهولت راه‌اندازی در محیط‌های Windows است. ابتدا تنظیم آستانه sensor و قالب‌های اعلان را بیاموزید.
`,
  },
  'terraform-reusable-modules': {
    contentEn: `## Introduction

Terraform modules are the cornerstone of reusable, maintainable infrastructure-as-code. Without modules, you end up copying and pasting Terraform code across projects, making global changes a nightmare. With well-designed modules, you define infrastructure patterns once and reuse them with different parameters. This guide teaches you to write, publish, and consume Terraform modules professionally.

## What Is a Terraform Module?

Any directory containing \`.tf\` files is a module. When you write Terraform code without modules, you're using the "root module." When you call a module from your root module using \`module\` blocks, you're using a child module.

\`\`\`
project/
├── main.tf          ← root module
├── variables.tf
├── outputs.tf
└── modules/
    ├── vpc/         ← child module
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── ec2/         ← another child module
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
\`\`\`

## Building Your First Reusable Module

Create a reusable AWS security group module:

\`\`\`hcl
# modules/security-group/variables.tf
variable "name" {
  description = "Name of the security group"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID to create the security group in"
  type        = string
}

variable "ingress_rules" {
  description = "List of ingress rules"
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}

variable "egress_allow_all" {
  description = "Whether to allow all outbound traffic"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to the security group"
  type        = map(string)
  default     = {}
}
\`\`\`

\`\`\`hcl
# modules/security-group/main.tf
resource "aws_security_group" "this" {
  name        = var.name
  description = "Managed by Terraform module"
  vpc_id      = var.vpc_id

  tags = merge(
    { "Name" = var.name },
    var.tags
  )
}

resource "aws_security_group_rule" "ingress" {
  for_each = { for i, rule in var.ingress_rules : i => rule }

  type              = "ingress"
  security_group_id = aws_security_group.this.id
  from_port         = each.value.from_port
  to_port           = each.value.to_port
  protocol          = each.value.protocol
  cidr_blocks       = each.value.cidr_blocks
  description       = each.value.description
}

resource "aws_security_group_rule" "egress_all" {
  count = var.egress_allow_all ? 1 : 0

  type              = "egress"
  security_group_id = aws_security_group.this.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}
\`\`\`

\`\`\`hcl
# modules/security-group/outputs.tf
output "id" {
  description = "Security group ID"
  value       = aws_security_group.this.id
}

output "arn" {
  description = "Security group ARN"
  value       = aws_security_group.this.arn
}
\`\`\`

## Using the Module

\`\`\`hcl
# root main.tf
module "web_sg" {
  source = "./modules/security-group"    # Local path

  name   = "web-tier-sg"
  vpc_id = module.vpc.vpc_id

  ingress_rules = [
    {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP from internet"
    },
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS from internet"
    }
  ]

  tags = {
    Environment = "production"
    Tier        = "web"
  }
}

module "app_sg" {
  source = "./modules/security-group"

  name   = "app-tier-sg"
  vpc_id = module.vpc.vpc_id

  ingress_rules = [
    {
      from_port   = 8080
      to_port     = 8080
      protocol    = "tcp"
      cidr_blocks = [module.vpc.private_subnet_cidrs[0]]
      description = "App traffic from web tier"
    }
  ]
}

# Reference module outputs
resource "aws_lb_target_group" "web" {
  vpc_id = module.vpc.vpc_id
  # ...
}

resource "aws_instance" "web" {
  vpc_security_group_ids = [module.web_sg.id]
  # ...
}
\`\`\`

## Module Versioning with Git Tags

\`\`\`bash
# Tag a module version
git tag v1.0.0
git push origin v1.0.0

# Use a specific version in root module
module "security_group" {
  source = "git::https://github.com/company/tf-modules.git//security-group?ref=v1.0.0"
  # ...
}

# Or using SSH
module "security_group" {
  source = "git@github.com:company/tf-modules.git//security-group?ref=v1.2.0"
  # ...
}
\`\`\`

## Publishing to Terraform Registry

\`\`\`
# Module naming convention for public registry:
terraform-<PROVIDER>-<NAME>
# Example: terraform-aws-security-group

# Required structure for registry:
terraform-aws-security-group/
├── main.tf
├── variables.tf
├── outputs.tf
├── README.md          ← Required, auto-generated docs
├── LICENSE
└── examples/
    └── complete/
        ├── main.tf   ← Working example
        └── README.md

# Publish:
# 1. Push to GitHub as public repo
# 2. Create GitHub release with semver tag (v1.0.0)
# 3. Sign into registry.terraform.io with GitHub
# 4. Click "Publish Module"
\`\`\`

## Advanced Module Patterns

**Conditional Resources:**
\`\`\`hcl
# modules/rds/main.tf
variable "create_read_replica" {
  type    = bool
  default = false
}

resource "aws_db_instance" "primary" {
  # main database config...
}

resource "aws_db_instance" "replica" {
  count = var.create_read_replica ? 1 : 0

  replicate_source_db = aws_db_instance.primary.id
  # replica config...
}
\`\`\`

**Dynamic Blocks:**
\`\`\`hcl
variable "subnets" {
  type = list(object({
    name = string
    cidr = string
    az   = string
  }))
}

resource "aws_subnet" "this" {
  for_each = { for s in var.subnets : s.name => s }

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = { "Name" = each.value.name }
}
\`\`\`

**Module Composition:**
\`\`\`hcl
# Compose higher-level modules from primitives
module "vpc" {
  source = "./modules/vpc"
  cidr   = "10.0.0.0/16"
}

module "eks_cluster" {
  source     = "./modules/eks"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
}

module "rds" {
  source     = "./modules/rds"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.database_subnet_ids

  # Allow EKS to connect to RDS
  allowed_security_group_ids = [module.eks_cluster.node_security_group_id]
}
\`\`\`

## Testing Modules with Terratest

\`\`\`go
// test/security_group_test.go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestSecurityGroupModule(t *testing.T) {
    t.Parallel()

    opts := &terraform.Options{
        TerraformDir: "../examples/complete",
        Vars: map[string]interface{}{
            "name":   "test-sg",
            "vpc_id": "vpc-12345678",
        },
    }

    // Cleanup after test
    defer terraform.Destroy(t, opts)

    // Apply
    terraform.InitAndApply(t, opts)

    // Validate output
    sgId := terraform.Output(t, opts, "id")
    assert.NotEmpty(t, sgId)
    assert.Regexp(t, "^sg-", sgId)
}
\`\`\`

## Module Documentation Best Practices

\`\`\`markdown
# terraform-aws-security-group

Creates AWS Security Groups with configurable ingress/egress rules.

## Usage

\`\`\`hcl
module "security_group" {
  source = "company/security-group/aws"
  version = "~> 1.0"

  name   = "web-sg"
  vpc_id = "vpc-12345"

  ingress_rules = [
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS"
    }
  ]
}
\`\`\`

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| aws | ~> 5.0 |

## Inputs

| Name | Description | Type | Required |
|------|------------|------|----------|
| name | Security group name | \`string\` | yes |
| vpc_id | VPC ID | \`string\` | yes |
| ingress_rules | Ingress rules | \`list(object)\` | no |

## Outputs

| Name | Description |
|------|------------|
| id | Security group ID |
| arn | Security group ARN |
\`\`\`

Reusable modules are the key to maintaining infrastructure at scale. Start with modules for your most-duplicated patterns, version them strictly, and always write examples that serve as both documentation and integration tests.
`,
    contentFa: `## مقدمه

ماژول‌های Terraform سنگ بنای infrastructure-as-code قابل استفاده مجدد و قابل نگهداری هستند. بدون ماژول‌ها، کد Terraform را در پروژه‌ها کپی-پیست می‌کنید که تغییرات گلوبال را کابوس می‌کند. با ماژول‌های طراحی‌شده خوب، الگوهای زیرساخت را یک بار تعریف کرده و با پارامترهای مختلف مجدداً استفاده می‌کنید.

## ساختار ماژول

\`\`\`
project/
├── main.tf          ← ماژول root
└── modules/
    └── security-group/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
\`\`\`

## نوشتن ماژول

\`\`\`hcl
# modules/security-group/variables.tf
variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "ingress_rules" {
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}
\`\`\`

\`\`\`hcl
# modules/security-group/main.tf
resource "aws_security_group" "this" {
  name   = var.name
  vpc_id = var.vpc_id
}

resource "aws_security_group_rule" "ingress" {
  for_each = { for i, rule in var.ingress_rules : i => rule }

  type              = "ingress"
  security_group_id = aws_security_group.this.id
  from_port         = each.value.from_port
  to_port           = each.value.to_port
  protocol          = each.value.protocol
  cidr_blocks       = each.value.cidr_blocks
}
\`\`\`

## استفاده از ماژول

\`\`\`hcl
module "web_sg" {
  source = "./modules/security-group"

  name   = "web-tier-sg"
  vpc_id = module.vpc.vpc_id

  ingress_rules = [
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS"
    }
  ]
}
\`\`\`

## نسخه‌بندی ماژول

\`\`\`bash
# تگ‌گذاری نسخه
git tag v1.0.0
git push origin v1.0.0

# استفاده از نسخه خاص
module "security_group" {
  source = "git::https://github.com/company/tf-modules.git//security-group?ref=v1.0.0"
}
\`\`\`

ماژول‌های قابل استفاده مجدد کلید نگهداری زیرساخت در مقیاس هستند. با ماژول‌ها برای الگوهای تکراری‌ترتان شروع کنید، آن‌ها را به‌دقت نسخه‌بندی کنید، و همیشه مثال‌هایی بنویسید که هم به عنوان مستندات و هم تست یکپارچه‌سازی عمل کنند.
`,
  },
  'saltstack-infrastructure-automation': {
    contentEn: `## Introduction

SaltStack (Salt) is a powerful infrastructure automation and configuration management tool that excels at managing thousands of servers simultaneously. Unlike Ansible's push model, Salt uses a master-minion architecture with a persistent, encrypted ZeroMQ message bus that enables real-time remote execution. This guide teaches you Salt from the basics to production-ready state management.

## Salt Architecture

\`\`\`
┌──────────────────────────────────────────────────────┐
│                   Salt Master                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  State Tree │  │  Pillar Data │  │  Event Bus  │  │
│  │  (/srv/salt)│  │ (secrets/cfg)│  │  (ZeroMQ)   │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  │
└───────────────────────┬──────────────────────────────┘
                        │ Port 4505 (publish)
                        │ Port 4506 (return)
          ┌─────────────┼─────────────┐
          │             │             │
   ┌──────▼─────┐ ┌─────▼──────┐ ┌──▼──────────┐
   │ Salt Minion│ │ Salt Minion│ │ Salt Minion │
   │ web-01     │ │ db-01      │ │ app-01      │
   └────────────┘ └────────────┘ └─────────────┘
\`\`\`

## Installation

\`\`\`bash
# Install Salt Master (on the control node)
curl -fsSL https://bootstrap.saltproject.io -o install_salt.sh
sudo sh install_salt.sh -M stable  # -M = install master

# Install Salt Minion (on managed nodes)
# Run on each server being managed:
curl -fsSL https://bootstrap.saltproject.io | sudo sh -s -- stable

# Configure minion to point to master
sudo nano /etc/salt/minion
\`\`\`

\`\`\`yaml
# /etc/salt/minion
master: 192.168.1.10    # Salt master IP or hostname
id: web-01              # Unique minion ID (defaults to hostname)
\`\`\`

\`\`\`bash
# Start services
sudo systemctl enable salt-master salt-minion
sudo systemctl start salt-master salt-minion

# On master: accept minion keys
salt-key -L              # List pending/accepted/rejected keys
salt-key -A              # Accept all pending keys
salt-key -a web-01       # Accept specific minion
\`\`\`

## Running Remote Execution Commands

\`\`\`bash
# Test connectivity to all minions
salt '*' test.ping

# Run on specific minion
salt 'web-01' test.ping

# Target by grain (OS, role, etc.)
salt -G 'os:Ubuntu' cmd.run 'uname -a'

# Target by regex
salt -E 'web-0[1-3]' cmd.run 'nginx -t'

# Target multiple minions with list
salt -L 'web-01,web-02,db-01' cmd.run 'systemctl status nginx'

# Parallel execution (default is parallel)
salt '*' cmd.run 'apt-get update' --timeout=120

# Get disk space from all servers
salt '*' disk.usage

# Collect CPU info
salt '*' grains.item cpu_model num_cpus

# Install a package on all web servers
salt -G 'role:webserver' pkg.install nginx
\`\`\`

## Salt Grains: Node Metadata

Grains are metadata about each minion — OS, CPU, memory, roles, etc.

\`\`\`bash
# List all grains for a minion
salt 'web-01' grains.ls

# Get specific grain
salt 'web-01' grains.get os
# Returns: Ubuntu

salt 'web-01' grains.get mem_total
# Returns: 16384 (MB)

# Set custom grain
salt 'web-01' grains.setval role webserver
salt 'web-01' grains.setval environment production

# Now target by custom grain
salt -G 'role:webserver' cmd.run 'nginx -s reload'
\`\`\`

Custom grains file on minion:
\`\`\`yaml
# /etc/salt/grains (on minion)
role: webserver
environment: production
datacenter: us-east-1
team: platform
\`\`\`

## Writing Salt States (Configuration Management)

States describe the desired configuration of your systems:

\`\`\`yaml
# /srv/salt/nginx/init.sls
# Install and configure nginx

nginx_package:
  pkg.installed:
    - name: nginx
    - version: latest

nginx_service:
  service.running:
    - name: nginx
    - enable: True
    - reload: True
    - require:
        - pkg: nginx_package
    - watch:
        - file: nginx_config

nginx_config:
  file.managed:
    - name: /etc/nginx/nginx.conf
    - source: salt://nginx/files/nginx.conf
    - template: jinja
    - user: root
    - group: root
    - mode: 644

# Apply the state
# salt 'web-01' state.apply nginx
\`\`\`

Jinja templating in state files:
\`\`\`yaml
# /srv/salt/nginx/files/nginx.conf
worker_processes {{ grains['num_cpus'] }};

events {
    worker_connections {{ pillar.get('nginx:worker_connections', 1024) }};
}

server {
    listen 80;
    server_name {{ grains['fqdn'] }};

    {% if pillar.get('ssl_enabled', False) %}
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/{{ grains['id'] }}.crt;
    {% endif %}
}
\`\`\`

## Pillar: Secure Configuration Data

Pillar stores sensitive data (passwords, API keys) that is only sent to targeted minions:

\`\`\`yaml
# /srv/pillar/top.sls
base:
  '*':
    - common
  'role:webserver':
    - match: grain
    - webserver
  'role:database':
    - match: grain
    - database

# /srv/pillar/database.sls
postgres:
  password: "super-secret-password"
  max_connections: 200
  shared_buffers: "4GB"

backup:
  s3_bucket: "company-db-backups"
  aws_key: "AKIAIOSFODNN7EXAMPLE"
  aws_secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
\`\`\`

\`\`\`bash
# Verify pillar data for a minion
salt 'db-01' pillar.get postgres

# Use in state file:
# {{ pillar['postgres']['password'] }}
\`\`\`

## Top File: Targeting States to Minions

\`\`\`yaml
# /srv/salt/top.sls
base:
  # Apply to all minions
  '*':
    - common.users
    - common.security
    - common.monitoring

  # Apply to web servers (by grain)
  'role:webserver':
    - match: grain
    - nginx
    - ssl

  # Apply to database servers
  'role:database':
    - match: grain
    - postgres
    - backup

  # Apply to production only
  'environment:production':
    - match: grain
    - monitoring.pagerduty

# Apply all states from top.sls
# salt '*' state.highstate
\`\`\`

## Salt Reactor: Event-Driven Automation

\`\`\`yaml
# /etc/salt/master.d/reactor.conf
reactor:
  - 'salt/minion/*/start':
    - /srv/reactor/new_minion.sls

  - 'salt/cloud/*/created':
    - /srv/reactor/cloud_provision.sls

# /srv/reactor/new_minion.sls
# When a new minion connects, apply base states
{% if data['id'].startswith('web-') %}
apply_web_states:
  local.state.apply:
    - tgt: {{ data['id'] }}
    - arg:
      - nginx
      - ssl
{% endif %}
\`\`\`

## Production Deployment Pattern

\`\`\`bash
#!/bin/bash
# deploy.sh - Deploy application with Salt

# 1. Target specific minions
TARGETS="web-0[1-3]"

# 2. Pull latest code
salt "$TARGETS" git.pull /opt/app origin master

# 3. Install dependencies
salt "$TARGETS" cmd.run "cd /opt/app && pip install -r requirements.txt"

# 4. Run database migrations (only on one server)
salt "web-01" cmd.run "cd /opt/app && python manage.py migrate"

# 5. Restart application
salt "$TARGETS" service.restart gunicorn

# 6. Verify deployment
salt "$TARGETS" cmd.run "curl -s http://localhost/health | python3 -m json.tool"

# 7. Check all services are running
salt "$TARGETS" service.status nginx gunicorn
\`\`\`

## Troubleshooting Salt

\`\`\`bash
# Check minion connectivity
salt-run manage.status    # Shows connected vs disconnected minions
salt-run manage.down      # Shows only disconnected minions

# Debug minion connection
salt-minion -l debug      # Run minion in foreground with debug logging

# Test state without applying
salt 'web-01' state.apply nginx test=True

# Check master event bus
salt-run state.event tagmatch='salt/*' full=True

# Sync custom modules/grains
salt '*' saltutil.sync_all

# Clear minion cache
salt 'web-01' saltutil.clear_cache
\`\`\`

SaltStack's real power emerges when you combine remote execution with state management and the reactor system — you get a platform that can self-heal your infrastructure by reacting to events and enforcing desired state automatically.
`,
    contentFa: `## مقدمه

SaltStack ابزار قدرتمند اتوماسیون زیرساخت و مدیریت پیکربندی است که در مدیریت هزاران سرور به‌صورت همزمان برتری دارد. برخلاف مدل push انسیبل، Salt از معماری master-minion با یک message bus رمزنگاری‌شده ZeroMQ استفاده می‌کند که اجرای real-time از راه دور را ممکن می‌سازد.

## نصب و راه‌اندازی

\`\`\`bash
# نصب Salt Master
curl -fsSL https://bootstrap.saltproject.io | sudo sh -s -- -M stable

# نصب Salt Minion روی سرورهای مدیریت‌شده
curl -fsSL https://bootstrap.saltproject.io | sudo sh -s -- stable

# پیکربندی minion
# /etc/salt/minion:
# master: 192.168.1.10

# پذیرش کلیدهای minion
salt-key -A
\`\`\`

## اجرای دستورات از راه دور

\`\`\`bash
# تست اتصال
salt '*' test.ping

# هدف‌گیری بر اساس grain
salt -G 'os:Ubuntu' cmd.run 'uname -a'

# نصب پکیج روی همه web server ها
salt -G 'role:webserver' pkg.install nginx

# بررسی فضای دیسک
salt '*' disk.usage
\`\`\`

## نوشتن Salt States

\`\`\`yaml
# /srv/salt/nginx/init.sls
nginx_package:
  pkg.installed:
    - name: nginx

nginx_service:
  service.running:
    - name: nginx
    - enable: True
    - watch:
        - file: nginx_config

nginx_config:
  file.managed:
    - name: /etc/nginx/nginx.conf
    - source: salt://nginx/files/nginx.conf
    - template: jinja
\`\`\`

## Pillar: داده‌های پیکربندی امن

\`\`\`yaml
# /srv/pillar/database.sls
postgres:
  password: "super-secret-password"
  max_connections: 200

# بررسی داده‌های pillar
salt 'db-01' pillar.get postgres
\`\`\`

## Top File: هدف‌گیری State ها

\`\`\`yaml
# /srv/salt/top.sls
base:
  '*':
    - common.users
    - common.security

  'role:webserver':
    - match: grain
    - nginx

  'role:database':
    - match: grain
    - postgres
\`\`\`

قدرت واقعی SaltStack زمانی ظهور می‌کند که اجرای از راه دور را با مدیریت state و سیستم reactor ترکیب کنید — پلتفرمی که می‌تواند با واکنش به رویدادها و اعمال خودکار وضعیت مطلوب، زیرساخت شما را self-heal کند.
`,
  },
  'puppet-configuration-management': {
    contentEn: `## Introduction

Puppet is a mature configuration management tool that uses a declarative language to define the desired state of your infrastructure. Unlike Ansible (agentless push), Puppet uses a master-agent architecture where agents periodically pull and apply configuration from the Puppet server (every 30 minutes by default).

## Puppet Architecture

\`\`\`
Puppet Server (master)
    |
    |-- puppet agent (node1) -- pulls catalog every 30 min
    |-- puppet agent (node2)
    |-- puppet agent (node3)
\`\`\`

Key concepts:
- **Catalog**: Compiled set of resources to apply to a node
- **Resource**: A thing to manage (file, package, service, user)
- **Module**: Reusable collection of manifests, templates, files
- **Hiera**: Hierarchical data lookup for separating data from code

## Installing Puppet Server

\`\`\`bash
# Ubuntu 22.04 — Puppet 8
wget https://apt.puppet.com/puppet8-release-jammy.deb
dpkg -i puppet8-release-jammy.deb
apt update
apt install puppetserver

# Configure memory (default 2GB — reduce for small servers)
# /etc/default/puppetserver
JAVA_ARGS="-Xms512m -Xmx512m"

systemctl enable puppetserver && systemctl start puppetserver
\`\`\`

## Installing Puppet Agent

\`\`\`bash
# On each managed node
wget https://apt.puppet.com/puppet8-release-jammy.deb
dpkg -i puppet8-release-jammy.deb
apt update && apt install puppet-agent

# Configure server address
echo "[main]
server = puppet.company.com" >> /etc/puppetlabs/puppet/puppet.conf

systemctl enable puppet && systemctl start puppet
\`\`\`

## Signing Agent Certificates

\`\`\`bash
# On puppet server — list pending certificate requests
puppetserver ca list

# Sign a specific agent
puppetserver ca sign --certname server01.company.com

# Sign all pending requests (careful in production!)
puppetserver ca sign --all

# Test agent connection
puppet agent --test  # Run on agent
\`\`\`

## Writing Puppet Manifests

\`\`\`puppet
# /etc/puppetlabs/code/environments/production/manifests/site.pp

node 'webserver01.company.com' {
  # Install nginx
  package { 'nginx':
    ensure => installed,
  }

  # Manage nginx config
  file { '/etc/nginx/nginx.conf':
    ensure  => file,
    content => template('nginx/nginx.conf.erb'),
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    require => Package['nginx'],
    notify  => Service['nginx'],
  }

  # Ensure service is running
  service { 'nginx':
    ensure  => running,
    enable  => true,
    require => Package['nginx'],
  }
}
\`\`\`

## Creating Puppet Modules

\`\`\`bash
# Generate module structure
puppet module generate company-nginx
# Creates:
# nginx/
#   manifests/
#     init.pp
#   templates/
#   files/
#   metadata.json
\`\`\`

\`\`\`puppet
# modules/profiles/manifests/webserver.pp
class profiles::webserver {
  $packages = ['nginx', 'php8.1-fpm']

  package { $packages:
    ensure => installed,
  }

  service { 'nginx':
    ensure  => running,
    enable  => true,
    require => Package['nginx'],
  }
}
\`\`\`

## Hiera — Separating Data from Code

\`\`\`yaml
# /etc/puppetlabs/code/environments/production/hiera.yaml
version: 5
hierarchy:
  - name: "Per-node data"
    path: "nodes/%{trusted.certname}.yaml"
  - name: "Common data"
    path: "common.yaml"
defaults:
  datadir: data

# data/common.yaml
profiles::webserver::max_connections: 1024

# data/nodes/webserver01.company.com.yaml
profiles::webserver::max_connections: 2048
\`\`\`

## Running Puppet

\`\`\`bash
# Manual run on agent (immediate, don't wait 30 min)
puppet agent --test

# Dry run — show what would change
puppet agent --test --noop

# Force run from server for all nodes
puppet kick --all  # deprecated
# Better: use Bolt or Orchestrator

# Check last run report
puppet agent --test --summarize
\`\`\`

## Summary

- Puppet excels at managing large fleets with consistent configuration
- Use modules to organize code; Hiera to separate data
- Agent checks in every 30 minutes automatically — no push needed
- The noop flag lets you preview changes safely before applying
- Puppet Forge has pre-built modules for common software (nginx, mysql, etc.)
`,
    contentFa: `## مقدمه

Puppet یک ابزار مدیریت پیکربندی بالغ است که از زبانی اعلانی برای تعریف وضعیت مطلوب زیرساخت استفاده میکند. بر خلاف Ansible (بدون agent)، Puppet از معماری master-agent استفاده میکند.

## نصب Puppet Server

\`\`\`bash
wget https://apt.puppet.com/puppet8-release-jammy.deb
dpkg -i puppet8-release-jammy.deb
apt update && apt install puppetserver
systemctl enable puppetserver && systemctl start puppetserver
\`\`\`

## نصب Puppet Agent

\`\`\`bash
apt install puppet-agent

echo "[main]
server = puppet.company.com" >> /etc/puppetlabs/puppet/puppet.conf

systemctl enable puppet && systemctl start puppet
\`\`\`

## نوشتن Manifest

\`\`\`puppet
node 'webserver01.company.com' {
  package { 'nginx':
    ensure => installed,
  }

  file { '/etc/nginx/nginx.conf':
    ensure  => file,
    content => template('nginx/nginx.conf.erb'),
    notify  => Service['nginx'],
  }

  service { 'nginx':
    ensure => running,
    enable => true,
  }
}
\`\`\`

## Hiera — جداسازی داده از کد

\`\`\`yaml
# data/common.yaml
profiles::webserver::max_connections: 1024
\`\`\`

## اجرا

\`\`\`bash
puppet agent --test       # اجرای دستی
puppet agent --test --noop  # حالت آزمون
\`\`\`

## خلاصه

- Puppet برای مدیریت ناوگانهای بزرگ با پیکربندی ثابت عالی است
- از ماژولها برای سازماندهی کد و Hiera برای جداسازی داده استفاده کنید
- Agent هر 30 دقیقه بهطور خودکار بررسی میکند
`,
  },
  'jenkins-cicd-infrastructure': {
    contentEn: `## Introduction

Jenkins is an open-source automation server that enables continuous integration and continuous delivery (CI/CD). For infrastructure teams, Jenkins automates testing of Ansible playbooks, Terraform plans, configuration changes, and deployments. This guide shows you how to set up Jenkins for infrastructure automation.

## Installing Jenkins

\`\`\`bash
# Ubuntu 22.04
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key |   gpg --dearmor -o /usr/share/keyrings/jenkins-keyring.gpg

echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.gpg]   https://pkg.jenkins.io/debian-stable binary/ |   tee /etc/apt/sources.list.d/jenkins.list > /dev/null

apt update
apt install jenkins openjdk-17-jdk

systemctl enable jenkins && systemctl start jenkins

# Get initial admin password
cat /var/lib/jenkins/secrets/initialAdminPassword
\`\`\`

Access Jenkins at \`http://server:8080\`.

## Required Plugins for Infrastructure

- Pipeline (for Jenkinsfile-based pipelines)
- Git (source code checkout)
- Ansible (run Ansible playbooks)
- Terraform (run Terraform commands)
- SSH Agent (SSH credential management)
- Credentials Binding (inject secrets into pipelines)

## Setting Up Credentials

\`\`\`
Jenkins → Manage Jenkins → Credentials → Add Credentials

Types to add:
- SSH Username with private key (for SSH to servers)
- Secret text (for API tokens, passwords)
- Username with password (for Docker registry, etc.)
\`\`\`

## Basic Jenkinsfile for Ansible

\`\`\`groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        ANSIBLE_HOST_KEY_CHECKING = 'False'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/company/infrastructure.git'
            }
        }

        stage('Syntax Check') {
            steps {
                sh 'ansible-playbook --syntax-check -i inventory/production site.yml'
            }
        }

        stage('Lint') {
            steps {
                sh 'ansible-lint site.yml'
            }
        }

        stage('Dry Run') {
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'deploy-key', keyFileVariable: 'SSH_KEY')]) {
                    sh '''
                        ansible-playbook -i inventory/production site.yml --check                           --private-key=$SSH_KEY
                    '''
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            input {
                message "Deploy to production?"
                ok "Deploy"
            }
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'deploy-key', keyFileVariable: 'SSH_KEY')]) {
                    sh '''
                        ansible-playbook -i inventory/production site.yml                           --private-key=$SSH_KEY
                    '''
                }
            }
        }
    }

    post {
        always {
            emailext(
                subject: "Build \${currentBuild.result}: \${env.JOB_NAME} #\${env.BUILD_NUMBER}",
                body: "\${env.BUILD_URL}",
                to: 'team@company.com'
            )
        }
    }
}
\`\`\`

## Terraform Pipeline

\`\`\`groovy
pipeline {
    agent any

    environment {
        TF_IN_AUTOMATION = 'true'
        AWS_ACCESS_KEY_ID = credentials('aws-access-key')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-key')
    }

    stages {
        stage('Terraform Init') {
            steps {
                sh 'terraform init -input=false'
            }
        }

        stage('Terraform Plan') {
            steps {
                sh 'terraform plan -out=tfplan -input=false'
                // Save plan as artifact
                archiveArtifacts artifacts: 'tfplan'
            }
        }

        stage('Terraform Apply') {
            when { branch 'main' }
            input { message "Apply Terraform plan?" }
            steps {
                sh 'terraform apply -input=false tfplan'
            }
        }
    }
}
\`\`\`

## Jenkins Agents (Distributed Build)

\`\`\`bash
# Add a build agent (on another server)
# Jenkins → Manage Jenkins → Nodes → New Node

# On agent server
java -jar agent.jar   -jnlpUrl http://jenkins:8080/computer/agent1/slave-agent.jnlp   -secret <secret>   -workDir /var/lib/jenkins-agent
\`\`\`

## Webhook Trigger from Git

\`\`\`groovy
// Trigger build on Git push
triggers {
    githubPush()
}

// Or poll for changes every 5 minutes
triggers {
    pollSCM('H/5 * * * *')
}
\`\`\`

## Summary

- Jenkins is the most flexible CI/CD tool for infrastructure automation
- Use Jenkinsfile (pipeline as code) stored in your repository
- Add approval gates (\`input\`) before deploying to production
- Use credentials management — never hardcode secrets in Jenkinsfiles
- Deploy Jenkins agents close to your target infrastructure for faster pipelines
`,
    contentFa: `## مقدمه

Jenkins یک سرور اتوماسیون متنباز است که CI/CD را فعال میکند. برای تیمهای زیرساخت، Jenkins تست Ansible playbookها، Terraform planها و استقرارها را خودکار میکند.

## نصب Jenkins

\`\`\`bash
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key |   gpg --dearmor -o /usr/share/keyrings/jenkins-keyring.gpg

apt update && apt install jenkins openjdk-17-jdk
systemctl enable jenkins && systemctl start jenkins

# رمز عبور اولیه
cat /var/lib/jenkins/secrets/initialAdminPassword
\`\`\`

## Jenkinsfile برای Ansible

\`\`\`groovy
pipeline {
    agent any

    stages {
        stage('Syntax Check') {
            steps {
                sh 'ansible-playbook --syntax-check -i inventory/production site.yml'
            }
        }

        stage('Dry Run') {
            steps {
                sh 'ansible-playbook -i inventory/production site.yml --check'
            }
        }

        stage('Deploy') {
            when { branch 'main' }
            input { message "استقرار در تولید؟" }
            steps {
                sh 'ansible-playbook -i inventory/production site.yml'
            }
        }
    }
}
\`\`\`

## Pipeline برای Terraform

\`\`\`groovy
pipeline {
    agent any

    stages {
        stage('Terraform Init') {
            steps { sh 'terraform init -input=false' }
        }
        stage('Terraform Plan') {
            steps { sh 'terraform plan -out=tfplan -input=false' }
        }
        stage('Terraform Apply') {
            when { branch 'main' }
            input { message "اعمال Terraform plan؟" }
            steps { sh 'terraform apply -input=false tfplan' }
        }
    }
}
\`\`\`

## خلاصه

- Jenkins انعطافپذیرترین ابزار CI/CD برای اتوماسیون زیرساخت است
- از Jenkinsfile (pipeline به عنوان کد) در مخزن خود استفاده کنید
- دروازههای تأیید قبل از استقرار در تولید اضافه کنید
- هرگز اسرار را در Jenkinsfileها hardcode نکنید
`,
  },
  'automated-network-testing': {
    contentEn: `## Introduction

Network automation is great, but how do you verify your network is working correctly after changes? Automated network testing lets you define expected behavior and run tests continuously — like unit tests for your network.

## Testing Tools Overview

| Tool | Purpose |
|------|---------|
| Batfish | Network configuration analysis (offline, no traffic) |
| Nornir + pytest | Test actual device state |
| NAPALM | Vendor-neutral network API |
| netmiko | SSH to network devices |
| pyATS/Genie | Cisco's test framework |

## Setting Up pytest for Network Testing

\`\`\`bash
# Install dependencies
pip install pytest nornir nornir-netmiko napalm

# Project structure
network-tests/
├── inventory/
│   ├── hosts.yaml
│   └── groups.yaml
├── tests/
│   ├── conftest.py
│   ├── test_connectivity.py
│   ├── test_routing.py
│   └── test_interfaces.py
└── pytest.ini
\`\`\`

## Nornir Inventory

\`\`\`yaml
# inventory/hosts.yaml
router01:
  hostname: 192.168.1.1
  platform: ios
  groups:
    - cisco

switch01:
  hostname: 192.168.1.10
  platform: ios
  groups:
    - cisco

# inventory/groups.yaml
cisco:
  username: admin
  password: cisco123
  connection_options:
    netmiko:
      extras:
        device_type: cisco_ios
\`\`\`

## conftest.py — Shared Fixtures

\`\`\`python
# tests/conftest.py
import pytest
from nornir import InitNornir
from nornir_netmiko.tasks import netmiko_send_command

@pytest.fixture(scope="session")
def nr():
    '''Initialize Nornir for all tests.'''
    return InitNornir(
        runner={"plugin": "threaded", "options": {"num_workers": 10}},
        inventory={
            "plugin": "SimpleInventory",
            "options": {
                "host_file": "inventory/hosts.yaml",
                "group_file": "inventory/groups.yaml",
            },
        },
    )

def get_output(nr, host, command):
    '''Helper: run command on single host.'''
    result = nr.filter(name=host).run(
        task=netmiko_send_command,
        command_string=command
    )
    return result[host][0].result
\`\`\`

## Writing Network Tests

\`\`\`python
# tests/test_interfaces.py
import pytest

def test_interface_up(nr):
    '''All expected interfaces should be up.'''
    expected_up = {
        "router01": ["GigabitEthernet0/0", "GigabitEthernet0/1"],
        "switch01": ["GigabitEthernet1/0/1", "GigabitEthernet1/0/2"],
    }

    for host, interfaces in expected_up.items():
        output = get_output(nr, host, "show interfaces status")
        for iface in interfaces:
            assert "connected" in output or iface in output,                 f"{host}: {iface} is not up!"

def test_no_err_disabled(nr):
    '''No interfaces should be err-disabled.'''
    result = nr.run(
        task=netmiko_send_command,
        command_string="show interfaces status err-disabled"
    )
    for host, task_result in result.items():
        output = task_result[0].result
        assert "err-disabled" not in output.lower(),             f"{host} has err-disabled interfaces: {output}"
\`\`\`

\`\`\`python
# tests/test_routing.py
import pytest

def test_default_route_exists(nr):
    '''All routers should have a default route.'''
    result = nr.filter(F(groups__contains="routers")).run(
        task=netmiko_send_command,
        command_string="show ip route 0.0.0.0"
    )
    for host, task_result in result.items():
        output = task_result[0].result
        assert "0.0.0.0/0" in output, f"{host}: no default route!"

def test_bgp_neighbors_established(nr):
    '''All BGP neighbors should be in Established state.'''
    result = nr.filter(F(groups__contains="routers")).run(
        task=netmiko_send_command,
        command_string="show bgp summary"
    )
    for host, task_result in result.items():
        output = task_result[0].result
        # Check no neighbors in Idle/Active/Connect state
        for line in output.split("\n"):
            if line and not line.startswith("BGP"):
                assert "Idle" not in line and "Active" not in line,                     f"{host}: BGP neighbor not Established: {line}"
\`\`\`

## Running Tests

\`\`\`bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_routing.py -v

# Run with HTML report
pytest tests/ -v --html=report.html

# Run only tests matching keyword
pytest tests/ -k "bgp" -v

# Parallel execution
pip install pytest-xdist
pytest tests/ -n 4  # Use 4 workers
\`\`\`

## Batfish for Offline Analysis

\`\`\`bash
# Run Batfish in Docker
docker run -d -p 9997:9997 -p 9996:9996 batfish/allinone

pip install pybatfish
\`\`\`

\`\`\`python
# Analyze network configs without touching devices
from pybatfish.client.session import Session
import pandas as pd

bf = Session(host="localhost")
bf.set_network("company-network")
bf.init_snapshot("configs/", name="snapshot1")

# Check for routing loops
loops = bf.q.detectLoops().answer().frame()
print("Routing loops:", len(loops))

# Verify reachability
reachability = bf.q.reachability(
    pathConstraints=PathConstraints(startLocation="router01"),
    headers=HeaderConstraints(dstIps="8.8.8.8")
).answer().frame()
print(reachability)
\`\`\`

## CI/CD Integration

\`\`\`yaml
# .gitlab-ci.yml or GitHub Actions
network-tests:
  stage: test
  script:
    - pip install -r requirements.txt
    - pytest tests/ -v --junit-xml=test-results.xml
  artifacts:
    reports:
      junit: test-results.xml
  only:
    - merge_requests
\`\`\`

## Summary

- Automated network tests catch regressions before users do
- Use Nornir + pytest for testing live device state
- Use Batfish for offline analysis of configuration changes
- Run tests in CI/CD pipelines after every infrastructure change
- Start with basic tests (interface up, routing tables) and add more over time
`,
    contentFa: `## مقدمه

اتوماسیون شبکه عالی است، اما چگونه تأیید میکنید شبکه بعد از تغییرات درست کار میکند؟ تست خودکار شبکه به شما اجازه میدهد رفتار مورد انتظار را تعریف کنید و بهطور مداوم آزمایش کنید.

## ابزارهای تست

| ابزار | هدف |
|-------|-----|
| Batfish | تحلیل پیکربندی آفلاین |
| Nornir + pytest | تست وضعیت واقعی دستگاه |
| NAPALM | API شبکه فروشنده-خنثی |

## راهاندازی pytest برای شبکه

\`\`\`bash
pip install pytest nornir nornir-netmiko napalm
\`\`\`

## نمونه تست

\`\`\`python
def test_interface_up(nr):
    '''تمام اینترفیسهای مورد انتظار باید Up باشند.'''
    expected_up = {
        "router01": ["GigabitEthernet0/0", "GigabitEthernet0/1"],
    }
    for host, interfaces in expected_up.items():
        output = get_output(nr, host, "show interfaces status")
        for iface in interfaces:
            assert "connected" in output, f"{host}: {iface} down!"

def test_default_route_exists(nr):
    '''همه روترها باید مسیر پیشفرض داشته باشند.'''
    result = nr.run(task=netmiko_send_command, command_string="show ip route 0.0.0.0")
    for host, task_result in result.items():
        assert "0.0.0.0/0" in task_result[0].result, f"{host}: no default route!"
\`\`\`

## اجرای تستها

\`\`\`bash
pytest tests/ -v
pytest tests/ -v --html=report.html
\`\`\`

## خلاصه

- تستهای خودکار شبکه رگرسیونها را قبل از کاربران شناسایی میکنند
- Nornir + pytest برای تست وضعیت دستگاه زنده استفاده کنید
- Batfish برای تحلیل آفلاین تغییرات پیکربندی استفاده کنید
- تستها را در CI/CD بعد از هر تغییر اجرا کنید
`,
  },
  'nornir-network-automation': {
    contentEn: `## Introduction

Nornir is a Python framework for network automation. Unlike Ansible, Nornir is pure Python — you write Python code (not YAML playbooks) to automate network devices. This gives you the full power of Python for complex logic, error handling, and integration with other systems.

## Why Nornir?

- Pure Python — no domain-specific language to learn
- Multi-threaded by default — runs tasks on all devices simultaneously
- Pluggable — supports Netmiko, NAPALM, Scrapli connections
- Easy to integrate with databases, APIs, monitoring systems
- Better for complex automation logic than Ansible YAML

## Installation

\`\`\`bash
pip install nornir nornir-utils nornir-netmiko nornir-napalm
\`\`\`

## Inventory Setup

\`\`\`yaml
# inventory/hosts.yaml
core-switch-01:
  hostname: 192.168.1.1
  platform: ios
  groups:
    - cisco_ios

edge-router-01:
  hostname: 192.168.1.254
  platform: ios
  groups:
    - cisco_ios

mikrotik-01:
  hostname: 192.168.1.2
  platform: routeros
  groups:
    - mikrotik

# inventory/groups.yaml
cisco_ios:
  username: admin
  password: cisco123
  connection_options:
    netmiko:
      extras:
        device_type: cisco_ios
        timeout: 30

mikrotik:
  username: admin
  password: mikrotik123
  connection_options:
    netmiko:
      extras:
        device_type: mikrotik_routeros
\`\`\`

## Basic Nornir Script

\`\`\`python
from nornir import InitNornir
from nornir_netmiko.tasks import netmiko_send_command
from nornir_utils.plugins.functions import print_result

# Initialize Nornir
nr = InitNornir(
    runner={"plugin": "threaded", "options": {"num_workers": 20}},
    inventory={
        "plugin": "SimpleInventory",
        "options": {
            "host_file": "inventory/hosts.yaml",
            "group_file": "inventory/groups.yaml",
        },
    },
)

# Run command on ALL devices simultaneously
result = nr.run(
    task=netmiko_send_command,
    command_string="show version"
)

# Print results
print_result(result)
\`\`\`

## Filtering Devices

\`\`\`python
from nornir.core.filter import F

# Filter by group
cisco_devices = nr.filter(F(groups__contains="cisco_ios"))

# Filter by hostname pattern
core_switches = nr.filter(F(hostname__startswith="192.168.1.1"))

# Filter by custom data attribute
# hosts.yaml: data: role: core
core_devices = nr.filter(F(data__role="core"))
\`\`\`

## Running Configuration Changes

\`\`\`python
from nornir_netmiko.tasks import netmiko_send_config

def configure_ntp(task):
    '''Configure NTP servers on Cisco IOS devices.'''
    ntp_config = [
        "ntp server 192.168.1.100 prefer",
        "ntp server 192.168.1.101",
    ]

    result = task.run(
        task=netmiko_send_config,
        config_commands=ntp_config
    )

    # Save config after change
    task.run(
        task=netmiko_send_command,
        command_string="write memory"
    )

    return result

# Run on all Cisco devices
result = nr.filter(F(groups__contains="cisco_ios")).run(task=configure_ntp)
print_result(result)
\`\`\`

## Error Handling

\`\`\`python
result = nr.run(task=configure_ntp)

# Check for failures
if result.failed:
    print("Failed devices:")
    for hostname, task_result in result.failed_hosts.items():
        print(f"  {hostname}: {task_result[0].exception}")

# Print only results that have issues
for hostname, task_result in result.items():
    if task_result.failed:
        print(f"FAILED: {hostname}")
    else:
        print(f"OK: {hostname}")
\`\`\`

## Collecting Data and Building Reports

\`\`\`python
import json
from nornir_netmiko.tasks import netmiko_send_command

def collect_interfaces(task):
    result = task.run(
        task=netmiko_send_command,
        command_string="show interfaces status"
    )
    # Parse output (or use ntc-templates for structured output)
    return result

# Collect from all devices
result = nr.run(task=collect_interfaces)

# Build inventory report
inventory_data = {}
for hostname, task_result in result.items():
    inventory_data[hostname] = task_result[0].result

with open("interface_report.json", "w") as f:
    json.dump(inventory_data, f, indent=2)
\`\`\`

## Using NAPALM for Structured Data

\`\`\`python
from nornir_napalm.plugins.tasks import napalm_get

# Get structured interface data (no manual parsing!)
result = nr.run(
    task=napalm_get,
    getters=["interfaces", "bgp_neighbors", "arp_table"]
)

for hostname, task_result in result.items():
    interfaces = task_result[0].result["interfaces"]
    for iface_name, iface_data in interfaces.items():
        if not iface_data["is_up"]:
            print(f"{hostname}: {iface_name} is DOWN")
\`\`\`

## Integrating with Netbox (Source of Truth)

\`\`\`python
import pynetbox
from nornir import InitNornir

# Pull inventory from Netbox instead of YAML files
nb = pynetbox.api("http://netbox.company.com", token="your-token")

# Build Nornir hosts from Netbox
hosts = {}
for device in nb.dcim.devices.filter(status="active"):
    hosts[device.name] = {
        "hostname": str(device.primary_ip.address).split("/")[0],
        "platform": device.platform.slug,
        "data": {
            "site": device.site.name,
            "role": device.device_role.name,
        }
    }
\`\`\`

## Summary

- Nornir is pure Python — use it when you need complex logic
- Multi-threaded by default — fast on large networks
- Use Netmiko for SSH connections, NAPALM for structured data
- Always handle failures — not all devices will respond the same way
- Combine with Netbox for a proper source of truth for your inventory
`,
    contentFa: `## مقدمه

Nornir یک فریمورک Python برای اتوماسیون شبکه است. بر خلاف Ansible، Nornir کد Python خالص است — شما کد Python مینویسید (نه playbook YAML) تا دستگاههای شبکه را خودکار کنید.

## نصب

\`\`\`bash
pip install nornir nornir-utils nornir-netmiko nornir-napalm
\`\`\`

## اسکریپت پایه Nornir

\`\`\`python
from nornir import InitNornir
from nornir_netmiko.tasks import netmiko_send_command
from nornir_utils.plugins.functions import print_result

nr = InitNornir(
    runner={"plugin": "threaded", "options": {"num_workers": 20}},
    inventory={
        "plugin": "SimpleInventory",
        "options": {
            "host_file": "inventory/hosts.yaml",
            "group_file": "inventory/groups.yaml",
        },
    },
)

# اجرا روی همه دستگاهها بهطور همزمان
result = nr.run(
    task=netmiko_send_command,
    command_string="show version"
)
print_result(result)
\`\`\`

## اعمال تغییرات پیکربندی

\`\`\`python
from nornir_netmiko.tasks import netmiko_send_config

def configure_ntp(task):
    ntp_config = [
        "ntp server 192.168.1.100 prefer",
        "ntp server 192.168.1.101",
    ]
    task.run(task=netmiko_send_config, config_commands=ntp_config)
    task.run(task=netmiko_send_command, command_string="write memory")

result = nr.filter(F(groups__contains="cisco_ios")).run(task=configure_ntp)
\`\`\`

## استفاده از NAPALM برای داده ساختارمند

\`\`\`python
from nornir_napalm.plugins.tasks import napalm_get

result = nr.run(task=napalm_get, getters=["interfaces", "bgp_neighbors"])
for hostname, task_result in result.items():
    interfaces = task_result[0].result["interfaces"]
    for iface_name, iface_data in interfaces.items():
        if not iface_data["is_up"]:
            print(f"{hostname}: {iface_name} Down است")
\`\`\`

## خلاصه

- Nornir کد Python خالص است — برای منطق پیچیده استفاده کنید
- بهطور پیشفرض multi-threaded است — روی شبکههای بزرگ سریع است
- از Netmiko برای اتصالات SSH و NAPALM برای داده ساختارمند استفاده کنید
- همیشه خرابیها را مدیریت کنید
`,
  },
  'zero-downtime-migration': {
    contentEn: `## Introduction

Zero-downtime migration means moving infrastructure, databases, or applications without users experiencing any service interruption. This is one of the most challenging problems in production engineering. A junior engineer often thinks "we'll just take a maintenance window" — but in 24/7 global services, there is no acceptable maintenance window. This guide teaches you the patterns and techniques to migrate infrastructure without downtime.

## The Blue-Green Deployment Pattern

Blue-green is the simplest zero-downtime strategy: maintain two identical environments (blue = current, green = new), switch traffic when green is ready.

\`\`\`
Before:                    During migration:              After:

Internet → LB → Blue       Internet → LB → Blue(90%)    Internet → LB → Green
                                              Green(10%)
\`\`\`

\`\`\`bash
# Example: Blue-Green with nginx upstream
# /etc/nginx/conf.d/app.conf

upstream backend_blue {
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
}

upstream backend_green {
    server 10.0.2.10:8080;
    server 10.0.2.11:8080;
}

# Currently routing to blue
upstream backend {
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}

# Switch to green: update upstream and reload
# nginx -t && nginx -s reload   (zero-downtime reload)
\`\`\`

## Database Migration Without Downtime

Database schema changes are the hardest part of zero-downtime deployments. The key: expand-contract pattern.

**Phase 1 - Expand** (deploy while old app runs):
\`\`\`sql
-- Add new column (nullable, so old app doesn't need it)
ALTER TABLE users ADD COLUMN phone_e164 VARCHAR(20) NULL;

-- Create index concurrently (doesn't lock table in PostgreSQL)
CREATE INDEX CONCURRENTLY idx_users_phone_e164 ON users(phone_e164);
\`\`\`

**Phase 2 - Migrate data** (backfill without locking):
\`\`\`python
#!/usr/bin/env python3
# backfill_phone.py - Migrate in small batches to avoid table locks
import psycopg2
import time

conn = psycopg2.connect("dbname=prod user=app")
cur = conn.cursor()

batch_size = 1000
last_id = 0

while True:
    cur.execute('''
        UPDATE users
        SET phone_e164 = normalize_phone(phone)
        WHERE id > %s
          AND phone_e164 IS NULL
          AND phone IS NOT NULL
        ORDER BY id
        LIMIT %s
        RETURNING id
    ''', (last_id, batch_size))

    rows = cur.fetchall()
    if not rows:
        break

    last_id = max(r[0] for r in rows)
    conn.commit()
    print(f"Migrated {len(rows)} rows, last id: {last_id}")
    time.sleep(0.1)  # Throttle: give database breathing room
\`\`\`

**Phase 3 - Deploy new app** (reads both columns, writes new column):
\`\`\`python
# Application reads phone_e164, falls back to old phone
def get_user_phone(user):
    return user.phone_e164 or normalize_phone(user.phone)
\`\`\`

**Phase 4 - Contract** (after verifying migration):
\`\`\`sql
-- Add NOT NULL constraint only after all rows filled
ALTER TABLE users ALTER COLUMN phone_e164 SET NOT NULL;

-- Drop old column later (separate deployment)
-- ALTER TABLE users DROP COLUMN phone;
\`\`\`

## Rolling Updates in Kubernetes

\`\`\`yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0    # Never reduce below 10 running pods
      maxSurge: 2          # Allow up to 12 pods during update

  template:
    spec:
      containers:
      - name: web
        image: company/web:v2.0
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3
        # App must pass readiness before receiving traffic
\`\`\`

\`\`\`bash
# Deploy and watch the rollout
kubectl set image deployment/web-app web=company/web:v2.1
kubectl rollout status deployment/web-app --timeout=5m

# If something goes wrong, rollback instantly
kubectl rollout undo deployment/web-app

# Check rollout history
kubectl rollout history deployment/web-app
\`\`\`

## Traffic Shifting with Canary Releases

\`\`\`yaml
# Canary: send 5% of traffic to new version
# Using Argo Rollouts for sophisticated canary
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: web-app
spec:
  strategy:
    canary:
      steps:
      - setWeight: 5     # 5% to canary
      - pause: {duration: 10m}
      - setWeight: 20    # 20% if no errors
      - pause: {duration: 10m}
      - setWeight: 50
      - pause: {duration: 5m}
      - setWeight: 100   # Full rollout
      analysis:
        templates:
        - templateName: error-rate
        startingStep: 1
        args:
        - name: service-name
          value: web-app-canary
\`\`\`

## Live Service Migration (Stateful)

Migrating a stateful service (like a database) with replication:

\`\`\`bash
# Example: Migrate MySQL to new server without downtime

# Step 1: Set up replication to new server
# On new server:
mysql -e "CHANGE MASTER TO
  MASTER_HOST='old-db.company.com',
  MASTER_USER='replication',
  MASTER_PASSWORD='replpass',
  MASTER_AUTO_POSITION=1;"
mysql -e "START SLAVE;"

# Step 2: Monitor replication lag
watch -n 5 "mysql -e 'SHOW SLAVE STATUS\G' | grep Seconds_Behind_Master"

# Step 3: When lag = 0, switch application to new server
# In app config: DB_HOST=new-db.company.com

# Step 4: After switch confirmed, stop old server
\`\`\`

## Health Checks and Graceful Shutdown

Applications must support graceful shutdown to avoid in-flight request drops:

\`\`\`python
# app.py - Flask app with graceful shutdown
from flask import Flask
import signal
import time
import threading

app = Flask(__name__)
shutdown_requested = False

@app.route('/health')
def health():
    if shutdown_requested:
        return 'shutting down', 503
    return 'ok', 200

@app.route('/api/data')
def data():
    # Simulate request processing
    time.sleep(0.1)
    return {'data': 'result'}

def handle_sigterm(signum, frame):
    global shutdown_requested
    shutdown_requested = True
    # Give in-flight requests 30 seconds to complete
    print("SIGTERM received, waiting 30s for in-flight requests...")
    time.sleep(30)

signal.signal(signal.SIGTERM, handle_sigterm)
\`\`\`

In Kubernetes, configure \`terminationGracePeriodSeconds\`:
\`\`\`yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]  # Wait for LB to stop sending traffic
\`\`\`

## Testing Zero-Downtime Migrations

\`\`\`bash
#!/bin/bash
# test_zero_downtime.sh - Run continuous requests during deployment
ERRORS=0
TOTAL=0

while true; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://app.company.com/api/health)
    TOTAL=$((TOTAL + 1))
    if [ "$HTTP_CODE" != "200" ]; then
        ERRORS=$((ERRORS + 1))
        echo "ERROR at $(date): HTTP $HTTP_CODE"
    fi
    sleep 0.1
done

# Run in background while you deploy:
# ./test_zero_downtime.sh &
# kubectl set image deployment/app app=company/app:v2
# # When done:
# kill %1
# echo "Total: $TOTAL, Errors: $ERRORS"
\`\`\`

Zero-downtime migrations require careful planning, proper health checks, and incremental traffic shifting. Start with blue-green for stateless services, use the expand-contract pattern for databases, and always test your rollback procedure before executing the migration.
`,
    contentFa: `## مقدمه

مهاجرت بدون خرابی (zero-downtime) به معنای جابجایی زیرساخت، دیتابیس‌ها یا اپلیکیشن‌ها بدون تجربه وقفه توسط کاربران است. این یکی از چالش‌برانگیزترین مسائل در مهندسی production است.

## الگوی Blue-Green

\`\`\`bash
# تغییر upstream nginx بدون restart
upstream backend_green {
    server 10.0.2.10:8080;
}

# reload بدون downtime
nginx -t && nginx -s reload
\`\`\`

## مهاجرت دیتابیس (Expand-Contract)

**فاز ۱ - Expand**: اضافه کردن ستون جدید
\`\`\`sql
ALTER TABLE users ADD COLUMN phone_e164 VARCHAR(20) NULL;
CREATE INDEX CONCURRENTLY idx_users_phone ON users(phone_e164);
\`\`\`

**فاز ۲ - Backfill دسته‌ای**
\`\`\`python
while True:
    cur.execute('''
        UPDATE users SET phone_e164 = normalize_phone(phone)
        WHERE id > %s AND phone_e164 IS NULL
        LIMIT 1000 RETURNING id
    ''', (last_id,))
    if not cur.fetchall(): break
    time.sleep(0.1)  # محدود کردن بار دیتابیس
\`\`\`

## Rolling Updates در Kubernetes

\`\`\`yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0   # هیچ‌وقت کمتر از replicas را کاهش ندهد
    maxSurge: 2         # تا ۲ pod اضافی مجاز است
\`\`\`

## Graceful Shutdown

\`\`\`python
def handle_sigterm(signum, frame):
    shutdown_requested = True
    # ۳۰ ثانیه صبر برای اتمام requestهای در حال پردازش
    time.sleep(30)

signal.signal(signal.SIGTERM, handle_sigterm)
\`\`\`

مهاجرت بدون downtime نیازمند برنامه‌ریزی دقیق، بررسی سلامت مناسب و انتقال تدریجی ترافیک است. با blue-green برای سرویس‌های بدون حالت شروع کنید و از الگوی expand-contract برای دیتابیس‌ها استفاده کنید.
`,
  },
  'helm-charts-kubernetes': {
    contentEn: `## Introduction

Helm is the package manager for Kubernetes. Just as apt manages packages on Ubuntu or npm manages Node.js dependencies, Helm manages Kubernetes application deployments. Without Helm, deploying even a simple application requires maintaining dozens of YAML files manually. With Helm, you create charts (packages) that can be versioned, shared, and deployed with a single command. This guide teaches you to use and create Helm charts professionally.

## Installing Helm

\`\`\`bash
# Install Helm (Linux)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify
helm version
# version.BuildInfo{Version:"v3.13.3", ...}

# Add common repositories
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
\`\`\`

## Using Existing Helm Charts

\`\`\`bash
# Search for charts
helm search repo nginx
helm search hub redis   # Search Artifact Hub (public registry)

# Install nginx ingress controller
helm install nginx-ingress ingress-nginx/ingress-nginx   --namespace ingress-nginx   --create-namespace   --set controller.replicaCount=2   --set controller.service.type=LoadBalancer

# Install with values file
helm install my-redis bitnami/redis   --namespace databases   --create-namespace   -f redis-values.yaml

# Check status
helm list -A                  # List all releases
helm status my-redis -n databases
helm get values my-redis -n databases   # See current values

# Upgrade a release
helm upgrade my-redis bitnami/redis   --namespace databases   --reuse-values   --set auth.password=newpassword

# Rollback to previous version
helm rollback my-redis 1 -n databases

# Uninstall
helm uninstall my-redis -n databases
\`\`\`

## Creating Your First Helm Chart

\`\`\`bash
# Scaffold a new chart
helm create myapp
\`\`\`

This creates:
\`\`\`
myapp/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default values
├── charts/             # Chart dependencies
└── templates/          # Kubernetes manifest templates
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── hpa.yaml
    ├── serviceaccount.yaml
    ├── _helpers.tpl    # Template helper functions
    └── NOTES.txt       # Post-install instructions
\`\`\`

## Chart.yaml

\`\`\`yaml
# Chart.yaml
apiVersion: v2
name: myapp
description: My production web application
type: application
version: 1.2.0           # Chart version (bump when chart changes)
appVersion: "3.5.1"      # Application version being packaged

dependencies:
  - name: redis
    version: "~18.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
\`\`\`

## Writing Templates

\`\`\`yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          ports:
            - containerPort: {{ .Values.service.port }}
          env:
            {{- range $key, $val := .Values.env }}
            - name: {{ $key }}
              value: {{ $val | quote }}
            {{- end }}
          {{- if .Values.resources }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- end }}
          {{- if .Values.configMap.enabled }}
          envFrom:
            - configMapRef:
                name: {{ include "myapp.fullname" . }}-config
          {{- end }}
\`\`\`

## values.yaml

\`\`\`yaml
# values.yaml
replicaCount: 2

image:
  repository: company/myapp
  pullPolicy: IfNotPresent
  tag: ""   # Defaults to Chart.appVersion

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: app.company.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: app-tls
      hosts:
        - app.company.com

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

env:
  LOG_LEVEL: "info"
  DATABASE_URL: "postgresql://app:pass@postgres:5432/appdb"

configMap:
  enabled: false

redis:
  enabled: false
  auth:
    password: "changeme"
\`\`\`

## Template Helper Functions (_helpers.tpl)

\`\`\`
{{/* templates/_helpers.tpl */}}

{{/* Expand chart name */}}
{{- define "myapp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Create full name */}}
{{- define "myapp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/* Common labels */}}
{{- define "myapp.labels" -}}
helm.sh/chart: {{ include "myapp.chart" . }}
{{ include "myapp.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
\`\`\`

## Environment-Specific Values

\`\`\`bash
# values-production.yaml
replicaCount: 10
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
autoscaling:
  enabled: true
  minReplicas: 5
  maxReplicas: 50

# values-staging.yaml
replicaCount: 2
resources:
  requests:
    cpu: 100m
    memory: 128Mi
\`\`\`

\`\`\`bash
# Deploy to staging
helm upgrade --install myapp ./myapp   -f values.yaml   -f values-staging.yaml   --namespace staging   --create-namespace

# Deploy to production
helm upgrade --install myapp ./myapp   -f values.yaml   -f values-production.yaml   --namespace production   --set image.tag=v3.5.2
\`\`\`

## Debugging and Testing

\`\`\`bash
# Render templates without deploying
helm template myapp ./myapp -f values.yaml

# Validate rendered templates
helm template myapp ./myapp | kubectl apply --dry-run=client -f -

# Lint chart
helm lint ./myapp

# Debug: show computed values
helm install myapp ./myapp --debug --dry-run

# After deployment: view rendered templates that were applied
helm get manifest myapp -n production
\`\`\`

## Packaging and Publishing

\`\`\`bash
# Package chart
helm package ./myapp
# Creates: myapp-1.2.0.tgz

# Create chart repository index
helm repo index . --url https://charts.company.com

# Upload to GitHub Pages (simple approach)
git add myapp-1.2.0.tgz index.yaml
git commit -m "Release myapp v1.2.0"
git push

# Or push to OCI registry (modern approach)
helm push myapp-1.2.0.tgz oci://registry.company.com/helm-charts
\`\`\`

Helm charts transform ad-hoc Kubernetes deployments into repeatable, version-controlled releases. Start by using community charts for databases and infrastructure, then create your own charts for application deployments.
`,
    contentFa: `## مقدمه

Helm مدیر بسته Kubernetes است. بدون Helm، استقرار حتی یک اپلیکیشن ساده نیازمند نگهداری دستی ده‌ها فایل YAML است. با Helm، chart (بسته) ایجاد می‌کنید که می‌توان آن را نسخه‌بندی، اشتراک‌گذاری و با یک دستور deploy کرد.

## نصب و استفاده

\`\`\`bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# اضافه کردن مخزن
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# نصب Redis
helm install my-redis bitnami/redis --namespace databases --create-namespace

# ارتقا
helm upgrade my-redis bitnami/redis --reuse-values --set auth.password=newpass

# بازگشت به نسخه قبلی
helm rollback my-redis 1 -n databases
\`\`\`

## ایجاد Chart

\`\`\`bash
helm create myapp
\`\`\`

\`\`\`yaml
# values.yaml
replicaCount: 2

image:
  repository: company/myapp
  tag: ""

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  hosts:
    - host: app.company.com
      paths:
        - path: /
          pathType: Prefix
\`\`\`

## استقرار محیط‌های مختلف

\`\`\`bash
# Staging
helm upgrade --install myapp ./myapp   -f values.yaml -f values-staging.yaml   --namespace staging

# Production
helm upgrade --install myapp ./myapp   -f values.yaml -f values-production.yaml   --set image.tag=v3.5.2
\`\`\`

## دیباگ

\`\`\`bash
# رندر بدون deploy
helm template myapp ./myapp -f values.yaml

# بررسی اعتبار
helm lint ./myapp
\`\`\`

Helm chart ها استقرارهای Kubernetes را از حالت موقتی به release های قابل تکرار و کنترل‌شده با نسخه تبدیل می‌کنند.
`,
  },
  'argocd-gitops-deployment': {
    contentEn: `## Introduction

ArgoCD is a declarative, GitOps continuous delivery tool for Kubernetes. GitOps means your Git repository is the single source of truth for your infrastructure and application state — ArgoCD continuously watches your Git repo and ensures your Kubernetes cluster matches what's defined there. If someone makes a manual change to the cluster, ArgoCD detects the drift and can automatically revert it. This guide teaches you to implement GitOps with ArgoCD.

## Why GitOps with ArgoCD?

Traditional CI/CD: Code → Build → Push → CI system PUSHES to cluster
GitOps: Code → Build → Update Git → ArgoCD PULLS from Git to cluster

Benefits:
- **Audit trail**: Every deployment is a Git commit (who, what, when)
- **Easy rollback**: \`git revert\` = instant rollback
- **Drift detection**: Cluster always matches desired state
- **No cluster credentials in CI**: CI doesn't need kubectl access

## Installing ArgoCD

\`\`\`bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret   -o jsonpath="{.data.password}" | base64 -d; echo

# Port-forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Access at https://localhost:8080  (admin / <password above>)
\`\`\`

Install ArgoCD CLI:
\`\`\`bash
curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd && sudo mv argocd /usr/local/bin/

# Login
argocd login localhost:8080 --username admin --password <password> --insecure
\`\`\`

## Exposing ArgoCD via Ingress

\`\`\`yaml
# argocd-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    nginx.ingress.kubernetes.io/ssl-passthrough: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  ingressClassName: nginx
  rules:
  - host: argocd.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 443
\`\`\`

## Creating Your First Application

\`\`\`yaml
# app-myapp.yaml - Define ArgoCD Application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-production
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io  # Clean up when app deleted
spec:
  project: default

  source:
    repoURL: https://github.com/company/k8s-manifests.git
    targetRevision: main              # Branch/tag/commit to watch
    path: apps/myapp/production       # Directory within repo

  destination:
    server: https://kubernetes.default.svc  # Target cluster
    namespace: production

  syncPolicy:
    automated:
      prune: true     # Delete resources removed from Git
      selfHeal: true  # Revert manual changes
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=foreground
    retry:
      limit: 5
      backoff:
        duration: 5s
        maxDuration: 3m
        factor: 2
\`\`\`

\`\`\`bash
kubectl apply -f app-myapp.yaml

# Check status
argocd app list
argocd app get myapp-production

# Manual sync (if automated sync disabled)
argocd app sync myapp-production

# Wait for sync to complete
argocd app wait myapp-production --sync
\`\`\`

## Repository Structure for GitOps

\`\`\`
k8s-manifests/
├── apps/
│   ├── myapp/
│   │   ├── base/                    # Kustomize base
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── kustomization.yaml
│   │   ├── staging/
│   │   │   ├── kustomization.yaml   # Patches for staging
│   │   │   └── values-patch.yaml
│   │   └── production/
│   │       ├── kustomization.yaml   # Patches for production
│   │       └── replicas-patch.yaml
│   └── database/
│       └── ...
├── infrastructure/
│   ├── ingress-nginx/
│   └── cert-manager/
└── argocd/
    └── applications/               # ArgoCD Application manifests
\`\`\`

Kustomization example:
\`\`\`yaml
# apps/myapp/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../base

patches:
  - path: replicas-patch.yaml

images:
  - name: company/myapp
    newTag: v3.5.2              # Update this for deployments
\`\`\`

## App of Apps Pattern

Manage multiple applications with a single ArgoCD Application:

\`\`\`yaml
# argocd/app-of-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-of-apps
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/company/k8s-manifests.git
    targetRevision: main
    path: argocd/applications    # Directory with all Application CRDs
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
\`\`\`

## CI/CD Integration

\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  update-image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: company/k8s-manifests
          token: \${{ secrets.GITOPS_TOKEN }}

      - name: Update image tag
        run: |
          # Update kustomization.yaml with new image tag
          cd apps/myapp/production
          kustomize edit set image company/myapp=company/myapp:\${{ github.sha }}

      - name: Commit and push
        run: |
          git config user.email "ci@company.com"
          git config user.name "CI Bot"
          git add .
          git commit -m "Update myapp to \${{ github.sha }}"
          git push
\`\`\`

## RBAC and Projects

\`\`\`yaml
# argocd-project.yaml - Limit what each team can deploy
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-backend
  namespace: argocd
spec:
  description: Backend team deployments

  sourceRepos:
    - 'https://github.com/company/k8s-manifests.git'

  destinations:
    - namespace: backend-staging
      server: https://kubernetes.default.svc
    - namespace: backend-production
      server: https://kubernetes.default.svc

  clusterResourceWhitelist: []  # No cluster-level resources
  namespaceResourceWhitelist:
    - group: 'apps'
      kind: 'Deployment'
    - group: ''
      kind: 'Service'
\`\`\`

## Monitoring ArgoCD

\`\`\`bash
# Watch all applications
argocd app list -w

# Check specific app diff (what would change on next sync)
argocd app diff myapp-production

# View sync history
argocd app history myapp-production

# Rollback to specific revision
argocd app rollback myapp-production 42
\`\`\`

ArgoCD transforms Kubernetes deployments into a Git-centric workflow. Once implemented, every deployment becomes auditable, every rollback becomes a git revert, and your cluster state becomes verifiable against your repository.
`,
    contentFa: `## مقدمه

ArgoCD یک ابزار delivery مستمر اعلانی GitOps برای Kubernetes است. GitOps یعنی مخزن Git شما تنها منبع حقیقت برای وضعیت زیرساخت و اپلیکیشنتان است. ArgoCD مخزن Git شما را به‌طور مستمر زیر نظر دارد و اطمینان می‌دهد که cluster Kubernetes شما با آنچه تعریف شده مطابقت دارد.

## نصب ArgoCD

\`\`\`bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# دریافت رمز عبور اولیه
kubectl -n argocd get secret argocd-initial-admin-secret   -o jsonpath="{.data.password}" | base64 -d
\`\`\`

## ایجاد Application

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-production
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/company/k8s-manifests.git
    targetRevision: main
    path: apps/myapp/production

  destination:
    server: https://kubernetes.default.svc
    namespace: production

  syncPolicy:
    automated:
      prune: true      # حذف منابع از Git حذف شده
      selfHeal: true   # بازگشت تغییرات دستی
\`\`\`

## یکپارچه‌سازی CI/CD

\`\`\`yaml
# .github/workflows/deploy.yml
- name: Update image tag
  run: |
    cd apps/myapp/production
    kustomize edit set image company/myapp=company/myapp:\${{ github.sha }}
    git add . && git commit -m "Update to \${{ github.sha }}" && git push
\`\`\`

ArgoCD استقرارهای Kubernetes را به یک جریان کاری Git-محور تبدیل می‌کند. هر استقرار قابل ردیابی، هر rollback یک git revert، و وضعیت cluster قابل تأیید در برابر مخزن شما می‌شود.
`,
  },
  'docker-compose-production': {
    contentEn: `## Introduction

Docker Compose is excellent for local development, but running it in production requires additional considerations: high availability, log management, secrets handling, health checks, and restart policies. This guide teaches you to configure Docker Compose for production workloads and understand when to move to Kubernetes or Docker Swarm instead.

## Production vs Development Compose Files

Use multiple compose files with override pattern:

\`\`\`yaml
# docker-compose.yml (base - shared between dev and prod)
version: '3.8'

services:
  app:
    image: company/myapp:\${APP_VERSION:-latest}
    environment:
      - DATABASE_URL
      - REDIS_URL
    networks:
      - backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB
      - POSTGRES_USER
      - POSTGRES_PASSWORD
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass \${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - backend

volumes:
  postgres-data:

networks:
  backend:
    driver: bridge
\`\`\`

\`\`\`yaml
# docker-compose.prod.yml (production overrides)
version: '3.8'

services:
  app:
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(\`app.company.com\`)"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"

  postgres:
    restart: unless-stopped
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./ssl:/etc/ssl/certs
      - /var/log/nginx:/var/log/nginx
    depends_on:
      - app

volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: none
      device: /data/postgres    # Mount to fast SSD
      o: bind
\`\`\`

\`\`\`bash
# Run in production (merges both files)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
\`\`\`

## Secrets Management

Never put secrets in docker-compose.yml directly:

\`\`\`bash
# Create .env file (never commit to git!)
cat > /opt/app/.env << 'EOF'
APP_VERSION=v3.5.2
DATABASE_URL=postgresql://appuser:Str0ngP@ss!@postgres:5432/appdb
POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=Str0ngP@ss!
REDIS_URL=redis://:RedisP@ss!@redis:6379
REDIS_PASSWORD=RedisP@ss!
EOF

chmod 600 /opt/app/.env

# Run with env file
docker compose --env-file /opt/app/.env up -d
\`\`\`

Using Docker secrets (Swarm mode):
\`\`\`bash
# Create secrets
echo "Str0ngP@ss!" | docker secret create postgres_password -
echo "RedisP@ss!" | docker secret create redis_password -

# Reference in compose (Swarm only)
version: '3.8'
services:
  postgres:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

secrets:
  postgres_password:
    external: true
\`\`\`

## Health Checks and Dependencies

\`\`\`yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s    # Grace period during startup

  # App only starts after DB is healthy
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy

  # Entrypoint waits for dependencies
  entrypoint: >
    sh -c "
      echo 'Waiting for postgres...'
      until pg_isready -h postgres -U app; do sleep 1; done
      echo 'Running migrations...'
      python manage.py migrate
      echo 'Starting server...'
      gunicorn app:app -w 4 -b 0.0.0.0:8080
    "
\`\`\`

## Logging Strategy

\`\`\`yaml
# Centralized logging with Loki
services:
  app:
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
        loki-labels: "job=app,environment=production"
        loki-retries: "5"
        loki-batch-size: "400"
        max-size: "50m"         # Local backup in case Loki is down

  # OR: Use json-file and ship with Promtail sidecar
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
        tag: "{{.Name}}/{{.ID}}"

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yaml:/etc/promtail/config.yaml
    command: -config.file=/etc/promtail/config.yaml
\`\`\`

## Deployment Script

\`\`\`bash
#!/bin/bash
# deploy.sh - Zero-downtime production deployment

set -euo pipefail

APP_DIR="/opt/myapp"
COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "=== Deploying $(APP_VERSION) to production ==="

cd "$APP_DIR"

# Pull new images first
$COMPOSE_CMD pull app

# Rolling restart (if using multiple replicas via nginx)
# Scale up with new version, then scale down old
$COMPOSE_CMD up -d --no-deps --scale app=4 app
sleep 15  # Wait for new instances to be healthy

# Verify health
if ! curl -sf http://localhost/health > /dev/null; then
    echo "Health check failed! Rolling back..."
    $COMPOSE_CMD up -d --no-deps --scale app=2 app
    exit 1
fi

# Scale back to normal
$COMPOSE_CMD up -d --no-deps --scale app=2 app

echo "=== Deployment complete ==="
\`\`\`

## Monitoring Container Resource Usage

\`\`\`bash
# Live stats for all containers
docker stats

# Stats in specific format for monitoring
docker stats --format "table {{.Name}}	{{.CPUPerc}}	{{.MemUsage}}	{{.NetIO}}	{{.BlockIO}}"

# Check logs with timestamps
docker compose logs -f --timestamps app

# Container events
docker events --filter 'type=container'
\`\`\`

## Backup Strategy for Compose Services

\`\`\`bash
#!/bin/bash
# backup.sh - Backup production database

BACKUP_DIR="/backup/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Dump database from running container
docker compose exec -T postgres   pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"   | gzip > "$BACKUP_DIR/backup_\${DATE}.sql.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete

# Upload to S3
aws s3 cp "$BACKUP_DIR/backup_\${DATE}.sql.gz"   "s3://company-backups/postgres/\${DATE}.sql.gz"
\`\`\`

Docker Compose in production works well for small to medium deployments (single server or few servers). When you need multi-host scheduling, auto-healing, or fine-grained resource management across a large cluster, graduate to Kubernetes. But for many teams, a well-configured Compose setup is simpler to operate and debug.
`,
    contentFa: `## مقدمه

Docker Compose برای توسعه محلی عالی است، اما اجرای آن در production نیازمند ملاحظات اضافی است: high availability، مدیریت لاگ، مدیریت secrets، health check و restart policy. این راهنما نحوه پیکربندی Docker Compose برای بارهای کاری production را آموزش می‌دهد.

## فایل‌های چندگانه Compose

\`\`\`bash
# ترکیب فایل‌های base و production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
\`\`\`

## مدیریت Secrets

\`\`\`bash
# هرگز secrets را در docker-compose.yml قرار ندهید
# ایجاد فایل .env (هرگز commit نکنید!)
cat > /opt/app/.env << 'EOF'
DATABASE_URL=postgresql://user:pass@postgres:5432/db
REDIS_PASSWORD=StrongPass!
EOF
chmod 600 /opt/app/.env
\`\`\`

## Health Checks

\`\`\`yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  depends_on:
    postgres:
      condition: service_healthy
\`\`\`

## پشتیبان‌گیری

\`\`\`bash
# dump دیتابیس از container در حال اجرا
docker compose exec -T postgres   pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"   | gzip > "backup_$(date +%Y%m%d).sql.gz"
\`\`\`

Docker Compose در production برای استقرارهای کوچک تا متوسط (یک یا چند سرور) به خوبی کار می‌کند. وقتی به زمان‌بندی چند-host، خود-ترمیمی یا مدیریت دقیق منابع نیاز دارید، به Kubernetes مهاجرت کنید.
`,
  },
  'custom-prometheus-exporters': {
    contentEn: `## Introduction

Prometheus exporters are programs that expose metrics in the Prometheus text format. While hundreds of exporters exist for common systems (node_exporter for Linux, mysqld_exporter for MySQL), you often need to monitor custom applications, proprietary systems, or business metrics. This guide teaches you to write production-quality custom exporters in Python and Go.

## Understanding the Prometheus Text Format

Every exporter exposes metrics at an HTTP endpoint (typically \`/metrics\`) in a simple text format:

\`\`\`
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
http_requests_total{method="POST",status="200"} 567
http_requests_total{method="GET",status="404"} 23

# HELP request_duration_seconds HTTP request duration in seconds
# TYPE request_duration_seconds histogram
request_duration_seconds_bucket{le="0.005"} 100
request_duration_seconds_bucket{le="0.01"} 145
request_duration_seconds_bucket{le="0.025"} 210
request_duration_seconds_bucket{le="+Inf"} 250
request_duration_seconds_sum 12.345
request_duration_seconds_count 250
\`\`\`

## Metric Types

| Type | Use Case | Example |
|------|----------|---------|
| Counter | Values that only increase | Requests served, errors |
| Gauge | Values that go up and down | Memory usage, queue size |
| Histogram | Distribution of values | Request duration, response size |
| Summary | Like histogram with quantiles | 99th percentile latency |

## Writing a Python Exporter

\`\`\`python
#!/usr/bin/env python3
# custom_exporter.py - Monitor a custom application API
import time
import requests
from prometheus_client import start_http_server, Counter, Gauge, Histogram, CollectorRegistry, REGISTRY
from prometheus_client.core import GaugeMetricFamily, CounterMetricFamily

# Define metrics (module-level)
REQUEST_COUNT = Counter(
    'myapp_requests_total',
    'Total requests to myapp',
    ['endpoint', 'status_code']
)

ACTIVE_USERS = Gauge(
    'myapp_active_users',
    'Current number of active users'
)

RESPONSE_TIME = Histogram(
    'myapp_response_duration_seconds',
    'API response time in seconds',
    ['endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

QUEUE_SIZE = Gauge(
    'myapp_queue_size',
    'Number of jobs in processing queue',
    ['queue_name']
)

def collect_metrics():
    '''Collect metrics from the application API.'''
    try:
        # Fetch stats from your application
        start = time.time()
        resp = requests.get('http://myapp:8080/internal/stats', timeout=5)
        resp.raise_for_status()
        duration = time.time() - start

        RESPONSE_TIME.labels(endpoint='/internal/stats').observe(duration)
        REQUEST_COUNT.labels(endpoint='/stats', status_code='200').inc()

        data = resp.json()
        ACTIVE_USERS.set(data['active_users'])

        for queue_name, size in data['queues'].items():
            QUEUE_SIZE.labels(queue_name=queue_name).set(size)

    except requests.RequestException as e:
        REQUEST_COUNT.labels(endpoint='/stats', status_code='error').inc()
        print(f"Failed to collect metrics: {e}")

if __name__ == '__main__':
    # Start Prometheus HTTP server on port 9100
    start_http_server(9100)
    print("Exporter running on :9100/metrics")

    while True:
        collect_metrics()
        time.sleep(15)  # Collect every 15 seconds
\`\`\`

## Custom Collector Class (More Control)

\`\`\`python
#!/usr/bin/env python3
# database_exporter.py - Expose database query metrics
import psycopg2
from prometheus_client import start_http_server, REGISTRY
from prometheus_client.core import GaugeMetricFamily, CounterMetricFamily
import time

class DatabaseCollector:
    '''Custom collector for PostgreSQL metrics.'''

    def __init__(self, dsn):
        self.dsn = dsn

    def collect(self):
        '''Called by Prometheus client on each scrape.'''
        conn = None
        try:
            conn = psycopg2.connect(self.dsn)
            cur = conn.cursor()

            # Table sizes
            table_size = GaugeMetricFamily(
                'postgres_table_size_bytes',
                'Size of each table in bytes',
                labels=['database', 'schema', 'table']
            )
            cur.execute('''
                SELECT current_database(), schemaname, tablename,
                       pg_total_relation_size(schemaname||'.'||tablename)
                FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ''')
            for row in cur.fetchall():
                table_size.add_metric([row[0], row[1], row[2]], row[3])
            yield table_size

            # Active connections
            connections = GaugeMetricFamily(
                'postgres_connections',
                'Number of database connections',
                labels=['state']
            )
            cur.execute('''
                SELECT state, count(*)
                FROM pg_stat_activity
                WHERE datname = current_database()
                GROUP BY state
            ''')
            for row in cur.fetchall():
                state = row[0] or 'null'
                connections.add_metric([state], row[1])
            yield connections

            # Slow queries (> 1 second)
            slow_queries = GaugeMetricFamily(
                'postgres_slow_queries',
                'Number of queries running longer than 1 second'
            )
            cur.execute('''
                SELECT count(*) FROM pg_stat_activity
                WHERE state = 'active'
                AND now() - query_start > interval '1 second'
            ''')
            slow_queries.add_metric([], cur.fetchone()[0])
            yield slow_queries

        except Exception as e:
            print(f"Collection failed: {e}")
        finally:
            if conn:
                conn.close()

if __name__ == '__main__':
    REGISTRY.register(DatabaseCollector(
        "postgresql://monitor:pass@localhost:5432/appdb"
    ))
    start_http_server(9187)
    print("PostgreSQL exporter on :9187/metrics")
    while True:
        time.sleep(60)
\`\`\`

## Dockerizing Your Exporter

\`\`\`dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY custom_exporter.py .
EXPOSE 9100

USER nobody
CMD ["python", "custom_exporter.py"]
\`\`\`

\`\`\`yaml
# docker-compose.yml addition
services:
  custom-exporter:
    build: ./exporters/myapp
    restart: unless-stopped
    ports:
      - "9100:9100"
    environment:
      - APP_URL=http://myapp:8080
    networks:
      - monitoring
\`\`\`

## Prometheus Scrape Configuration

\`\`\`yaml
# prometheus.yml
scrape_configs:
  - job_name: 'custom-myapp'
    scrape_interval: 15s
    scrape_timeout: 10s
    static_configs:
      - targets: ['custom-exporter:9100']
        labels:
          environment: production
          app: myapp

  # Multiple instances with relabeling
  - job_name: 'myapp-instances'
    static_configs:
      - targets:
        - 'app-01:9100'
        - 'app-02:9100'
        - 'app-03:9100'
    relabel_configs:
      - source_labels: [__address__]
        regex: '(.*):.*'
        target_label: instance
        replacement: '$1'
\`\`\`

## Business Metrics Exporter

\`\`\`python
# business_metrics.py - Monitor business KPIs
class BusinessMetricsCollector:
    def __init__(self, db_dsn):
        self.db_dsn = db_dsn

    def collect(self):
        # Orders today
        orders_today = GaugeMetricFamily(
            'business_orders_today_total',
            'Number of orders placed today'
        )
        # Revenue today
        revenue = GaugeMetricFamily(
            'business_revenue_today_usd',
            'Revenue generated today in USD'
        )
        # Active subscriptions
        subscriptions = GaugeMetricFamily(
            'business_active_subscriptions',
            'Number of active subscriptions',
            labels=['plan']
        )

        conn = psycopg2.connect(self.db_dsn)
        cur = conn.cursor()

        cur.execute("SELECT count(*) FROM orders WHERE created_at::date = CURRENT_DATE")
        orders_today.add_metric([], cur.fetchone()[0])
        yield orders_today

        cur.execute("SELECT COALESCE(sum(amount), 0) FROM orders WHERE created_at::date = CURRENT_DATE")
        revenue.add_metric([], float(cur.fetchone()[0]))
        yield revenue

        cur.execute("SELECT plan, count(*) FROM subscriptions WHERE status='active' GROUP BY plan")
        for plan, count in cur.fetchall():
            subscriptions.add_metric([plan], count)
        yield subscriptions

        conn.close()
\`\`\`

## Testing Your Exporter

\`\`\`bash
# Start exporter
python custom_exporter.py &

# Check metrics are exposed
curl -s http://localhost:9100/metrics | head -20

# Verify specific metric
curl -s http://localhost:9100/metrics | grep myapp_active_users

# Test with promtool
promtool check metrics http://localhost:9100/metrics
\`\`\`

Writing custom exporters turns any system that has an API or database into a first-class Prometheus citizen. The key principle: collect metrics close to the source, use appropriate metric types, and add labels that enable useful aggregations and filtering.
`,
    contentFa: `## مقدمه

Prometheus exporter ها برنامه‌هایی هستند که معیارها را در قالب متنی Prometheus در معرض قرار می‌دهند. در حالی که صدها exporter برای سیستم‌های رایج وجود دارد، اغلب نیاز دارید اپلیکیشن‌های سفارشی یا معیارهای کسب‌وکار را پایش کنید.

## نوشتن Exporter با Python

\`\`\`python
from prometheus_client import start_http_server, Counter, Gauge, Histogram
import time, requests

REQUEST_COUNT = Counter('myapp_requests_total', 'Total requests', ['endpoint', 'status'])
ACTIVE_USERS = Gauge('myapp_active_users', 'Active users')
RESPONSE_TIME = Histogram('myapp_response_seconds', 'Response time', ['endpoint'])

def collect_metrics():
    try:
        start = time.time()
        data = requests.get('http://myapp:8080/internal/stats', timeout=5).json()
        RESPONSE_TIME.labels(endpoint='/stats').observe(time.time() - start)
        ACTIVE_USERS.set(data['active_users'])
    except Exception as e:
        REQUEST_COUNT.labels(endpoint='/stats', status='error').inc()

if __name__ == '__main__':
    start_http_server(9100)
    while True:
        collect_metrics()
        time.sleep(15)
\`\`\`

## Custom Collector

\`\`\`python
from prometheus_client.core import GaugeMetricFamily

class DatabaseCollector:
    def collect(self):
        conn = psycopg2.connect(self.dsn)
        cur = conn.cursor()

        size_metric = GaugeMetricFamily(
            'postgres_table_size_bytes',
            'Table size in bytes',
            labels=['schema', 'table']
        )
        cur.execute("SELECT schemaname, tablename, pg_total_relation_size(schemaname||'.'||tablename) FROM pg_tables")
        for row in cur.fetchall():
            size_metric.add_metric([row[0], row[1]], row[2])
        yield size_metric
\`\`\`

## پیکربندی Prometheus

\`\`\`yaml
scrape_configs:
  - job_name: 'custom-myapp'
    scrape_interval: 15s
    static_configs:
      - targets: ['custom-exporter:9100']
        labels:
          environment: production
\`\`\`

نوشتن exporter های سفارشی هر سیستمی که API یا دیتابیس دارد را به یک شهروند درجه اول Prometheus تبدیل می‌کند.
`,
  },
  'hashicorp-vault-secrets': {
    contentEn: `## Introduction

HashiCorp Vault is a secrets management tool that provides secure storage and access control for sensitive data like API keys, passwords, and certificates. Without Vault, secrets end up hardcoded in code, stored in environment variables, or scattered across configuration files — any of which are security risks. This guide teaches you to deploy Vault, store secrets, and integrate it with your applications.

## Why Vault?

- **Dynamic secrets**: Vault can generate database credentials on-demand (auto-expiring)
- **Secret leasing**: Secrets have TTLs and are automatically revoked
- **Audit logging**: Every secret access is logged
- **Fine-grained access**: Policies control exactly what each app can read
- **Encryption as a service**: Encrypt data without managing keys yourself

## Installation and Initialization

\`\`\`bash
# Install Vault (Linux)
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install vault

# Docker deployment
docker run -d   --name vault   --cap-add IPC_LOCK   -p 8200:8200   -e VAULT_ADDR=http://0.0.0.0:8200   -v vault-data:/vault/data   -v ./vault-config.hcl:/vault/config/vault.hcl   hashicorp/vault:latest server
\`\`\`

\`\`\`hcl
# vault-config.hcl
ui = true

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1    # Enable TLS in production!
}

api_addr = "http://vault.company.com:8200"
\`\`\`

\`\`\`bash
# Initialize Vault (run once)
export VAULT_ADDR='http://localhost:8200'
vault operator init -key-shares=5 -key-threshold=3

# This outputs:
# Unseal Key 1: XXXX
# Unseal Key 2: XXXX
# ...
# Initial Root Token: hvs.XXXX

# SAVE THESE SECURELY! You need 3 of 5 keys to unseal

# Unseal Vault (need 3 keys)
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>

# Verify
vault status

# Login with root token
vault login hvs.XXXX
\`\`\`

## Storing and Retrieving Secrets

\`\`\`bash
# Enable KV secrets engine
vault secrets enable -path=secret kv-v2

# Store a secret
vault kv put secret/myapp/database   username=appuser   password=Str0ngP@ss!   host=db.company.com

# Read a secret
vault kv get secret/myapp/database
# Key      Value
# ---      -----
# username appuser
# password Str0ngP@ss!

# Get specific field
vault kv get -field=password secret/myapp/database

# Update (add new version)
vault kv patch secret/myapp/database password=NewP@ss!

# List versions
vault kv metadata get secret/myapp/database

# Read specific version
vault kv get -version=1 secret/myapp/database
\`\`\`

## Access Policies

\`\`\`hcl
# policies/myapp-policy.hcl
# Allow myapp to read its own secrets only
path "secret/data/myapp/*" {
  capabilities = ["read", "list"]
}

# Allow renewing its own token
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Deny everything else (implicit)
\`\`\`

\`\`\`bash
# Create policy
vault policy write myapp policies/myapp-policy.hcl

# Create token with policy
vault token create -policy=myapp -ttl=1h -renewable=true

# Or use AppRole auth (better for applications)
vault auth enable approle
vault write auth/approle/role/myapp   token_policies=myapp   token_ttl=1h   token_max_ttl=4h

# Get role credentials
vault read auth/approle/role/myapp/role-id
vault write -f auth/approle/role/myapp/secret-id

# App logs in with these credentials
vault write auth/approle/login   role_id=<role-id>   secret_id=<secret-id>
\`\`\`

## Dynamic Database Secrets

The killer feature: Vault generates temporary DB credentials that auto-expire:

\`\`\`bash
# Enable database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/myapp-db   plugin_name=postgresql-database-plugin   allowed_roles="myapp-role"   connection_url="postgresql://vault_admin:vaultpass@db.company.com:5432/appdb"   username="vault_admin"   password="vaultpass"

# Define role that creates short-lived credentials
vault write database/roles/myapp-role   db_name=myapp-db   creation_statements="CREATE ROLE '{{name}}' WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO '{{name}}';"   default_ttl="1h"   max_ttl="24h"

# Request dynamic credentials (each request gets unique credentials!)
vault read database/creds/myapp-role
# Key                Value
# ---                -----
# lease_duration     1h
# username           v-myapp-AbCdEfGh1234
# password           A1B2C3D4E5F6G7H8I9J0
\`\`\`

## Application Integration

\`\`\`python
#!/usr/bin/env python3
# vault_client.py - Fetch secrets from Vault at startup
import hvac
import os
import time

class VaultSecrets:
    def __init__(self, vault_addr, role_id, secret_id):
        self.client = hvac.Client(url=vault_addr)
        self.client.auth.approle.login(
            role_id=role_id,
            secret_id=secret_id
        )

    def get_secret(self, path, key=None):
        data = self.client.secrets.kv.v2.read_secret_version(
            path=path,
            mount_point='secret'
        )
        if key:
            return data['data']['data'][key]
        return data['data']['data']

    def get_database_credentials(self, role):
        '''Get dynamic database credentials.'''
        creds = self.client.secrets.database.generate_credentials(name=role)
        return {
            'username': creds['data']['username'],
            'password': creds['data']['password'],
            'lease_id': creds['lease_id'],
            'lease_duration': creds['lease_duration']
        }

    def renew_token(self):
        '''Renew Vault token before expiry.'''
        self.client.auth.token.renew_self()

# Usage in application
vault = VaultSecrets(
    vault_addr=os.environ['VAULT_ADDR'],
    role_id=os.environ['VAULT_ROLE_ID'],
    secret_id=os.environ['VAULT_SECRET_ID']
)

# Get static secret
api_key = vault.get_secret('myapp/external-api', 'api_key')

# Get dynamic database credentials
db_creds = vault.get_database_credentials('myapp-role')
db_url = f"postgresql://{db_creds['username']}:{db_creds['password']}@db:5432/appdb"
\`\`\`

## Kubernetes Integration with Vault Agent

\`\`\`yaml
# vault-agent-config.hcl (as ConfigMap)
auto_auth {
  method "kubernetes" {
    mount_path = "auth/kubernetes"
    config = {
      role = "myapp"
    }
  }

  sink "file" {
    config = {
      path = "/home/vault/.vault-token"
    }
  }
}

template {
  source      = "/vault/templates/config.tmpl"
  destination = "/vault/secrets/config.env"
  perms       = 0400
}
\`\`\`

\`\`\`
# config.tmpl
{{ with secret "secret/data/myapp/config" }}
DATABASE_URL=postgresql://{{ .Data.data.db_user }}:{{ .Data.data.db_pass }}@db:5432/app
API_KEY={{ .Data.data.api_key }}
{{ end }}
\`\`\`

\`\`\`yaml
# Pod spec with Vault Agent sidecar
spec:
  serviceAccountName: myapp
  initContainers:
    - name: vault-agent
      image: vault:latest
      command: ["vault", "agent", "-config=/vault/config/vault-agent.hcl", "-exit-after-auth"]
      volumeMounts:
        - name: vault-config
          mountPath: /vault/config
        - name: vault-secrets
          mountPath: /vault/secrets
  containers:
    - name: app
      env:
        - name: CONFIG_PATH
          value: /vault/secrets/config.env
      volumeMounts:
        - name: vault-secrets
          mountPath: /vault/secrets
\`\`\`

Vault transforms secret management from a scattered, insecure practice to a centralized, audited system. Start with static KV secrets, then graduate to dynamic database credentials — the productivity and security gains are immediate.
`,
    contentFa: `## مقدمه

HashiCorp Vault ابزار مدیریت secrets است که ذخیره‌سازی امن و کنترل دسترسی برای داده‌های حساس مثل کلیدهای API، رمزهای عبور و گواهی‌ها را فراهم می‌کند.

## نصب و راه‌اندازی

\`\`\`bash
# راه‌اندازی Docker
docker run -d --name vault --cap-add IPC_LOCK   -p 8200:8200 -v vault-data:/vault/data   hashicorp/vault:latest server

# مقداردهی اولیه (یک‌بار)
export VAULT_ADDR='http://localhost:8200'
vault operator init -key-shares=5 -key-threshold=3

# Unseal با ۳ کلید
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>
\`\`\`

## ذخیره و بازیابی Secrets

\`\`\`bash
# فعال‌سازی KV engine
vault secrets enable -path=secret kv-v2

# ذخیره secret
vault kv put secret/myapp/database   username=appuser   password=Str0ngP@ss!

# خواندن secret
vault kv get secret/myapp/database

# دریافت فیلد خاص
vault kv get -field=password secret/myapp/database
\`\`\`

## Secrets دیتابیس پویا

\`\`\`bash
# Vault اعتبارنامه‌های موقت ایجاد می‌کند که خودکار منقضی می‌شوند
vault secrets enable database

vault write database/roles/myapp-role   db_name=myapp-db   default_ttl="1h"   max_ttl="24h"   creation_statements="CREATE ROLE '{{name}}' WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';"

# هر درخواست اعتبارنامه منحصربه‌فرد ایجاد می‌کند
vault read database/creds/myapp-role
\`\`\`

## یکپارچه‌سازی با Python

\`\`\`python
import hvac

vault = hvac.Client(url='http://vault:8200')
vault.auth.approle.login(role_id=role_id, secret_id=secret_id)

secret = vault.secrets.kv.v2.read_secret_version(path='myapp/config')
api_key = secret['data']['data']['api_key']
\`\`\`

Vault مدیریت secrets را از یک رویه پراکنده و ناامن به یک سیستم متمرکز و ممیزی‌شده تبدیل می‌کند.
`,
  },
  'istio-service-mesh': {
    contentEn: `## Introduction

Istio is a service mesh that adds observability, traffic management, and security to microservices without changing application code. In a microservices architecture with dozens of services, managing things like mutual TLS between services, circuit breakers, retries, and distributed tracing becomes complex. Istio handles all of this at the infrastructure level using sidecar proxies (Envoy). This guide teaches you to deploy and use Istio effectively.

## How Istio Works

Istio injects a sidecar proxy (Envoy) alongside every pod:

\`\`\`
Without Istio:               With Istio:
┌──────────────┐             ┌────────────────────────┐
│   Service A  │─────────────│  Service A  │  Envoy  │
└──────────────┘             └────────────────────────┘
       │                                │
       ▼                                ▼ (intercepted)
┌──────────────┐             ┌────────────────────────┐
│   Service B  │             │  Envoy  │  Service B  │
└──────────────┘             └────────────────────────┘

All traffic passes through Envoy sidecars, which:
- Enforce mTLS between services
- Collect metrics and traces
- Apply routing rules and retries
\`\`\`

## Installing Istio

\`\`\`bash
# Download Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-1.20.0
export PATH=$PWD/bin:$PATH

# Install with demo profile (good for learning)
istioctl install --set profile=demo -y

# Verify installation
kubectl get pods -n istio-system

# Enable automatic sidecar injection for a namespace
kubectl label namespace default istio-injection=enabled

# Verify injection is working (deploy test app)
kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml
kubectl get pods  # Should see 2 containers per pod (app + istio-proxy)
\`\`\`

## Traffic Management

Istio uses VirtualService and DestinationRule to control traffic:

\`\`\`yaml
# VirtualService: defines routing rules
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
  - myapp
  http:
  # Canary: 10% traffic to v2
  - route:
    - destination:
        host: myapp
        subset: v1
      weight: 90
    - destination:
        host: myapp
        subset: v2
      weight: 10

---
# DestinationRule: defines subsets (versions)
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: myapp
spec:
  host: myapp
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  trafficPolicy:
    connectionPool:
      http:
        http2MaxRequests: 1000
    outlierDetection:    # Circuit breaker
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
\`\`\`

## Retries and Timeouts

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: payment-service
spec:
  hosts:
  - payment-service
  http:
  - timeout: 5s          # Total timeout for request
    retries:
      attempts: 3         # Retry up to 3 times
      perTryTimeout: 2s   # Each try max 2s
      retryOn: "connect-failure,reset,503"
    route:
    - destination:
        host: payment-service
\`\`\`

## mTLS Between Services

\`\`\`yaml
# Enable strict mTLS for all services in namespace
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT    # All traffic must use mTLS

---
# Allow specific service to use permissive (during migration)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: legacy-service
  namespace: production
spec:
  selector:
    matchLabels:
      app: legacy
  mtls:
    mode: PERMISSIVE
\`\`\`

## Authorization Policies

\`\`\`yaml
# Only allow frontend to call backend
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: backend-policy
  namespace: production
spec:
  selector:
    matchLabels:
      app: backend
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/production/sa/frontend"]
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/*"]
\`\`\`

## Observability with Kiali

Kiali provides a dashboard showing the service mesh topology:

\`\`\`bash
# Install observability addons
kubectl apply -f samples/addons/

# Access Kiali dashboard
istioctl dashboard kiali

# Access Grafana (Istio metrics)
istioctl dashboard grafana

# Access Jaeger (distributed tracing)
istioctl dashboard jaeger
\`\`\`

Kiali shows:
- Service dependency graph with traffic flow
- Error rates and latency per service
- mTLS status between services
- Traffic split percentages for canary deployments

## Ingress Gateway

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: myapp-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: myapp-tls-cert
    hosts:
    - app.company.com

---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp-ingress
spec:
  hosts:
  - app.company.com
  gateways:
  - myapp-gateway
  http:
  - route:
    - destination:
        host: myapp
        port:
          number: 8080
\`\`\`

## Debugging Istio Issues

\`\`\`bash
# Check sidecar injection
kubectl get pod myapp-xxx -o jsonpath='{.spec.containers[*].name}'
# Should show: myapp istio-proxy

# Check proxy configuration
istioctl proxy-config cluster myapp-xxx.default

# Check if mTLS is working
istioctl x check-inject -n production

# View Envoy access logs
kubectl logs myapp-xxx -c istio-proxy | head -20

# Analyze configuration for issues
istioctl analyze -n production

# Check traffic policies applied
istioctl proxy-config listener myapp-xxx.default
\`\`\`

Istio adds significant operational complexity but pays off in large microservice deployments where you need consistent security, observability, and traffic control across dozens of services. Start with observability only (no policy enforcement) before enabling mTLS and authorization policies.
`,
    contentFa: `## مقدمه

Istio یک service mesh است که بدون تغییر کد اپلیکیشن، observability، مدیریت ترافیک و امنیت به microservice ها اضافه می‌کند. در معماری microservice با ده‌ها سرویس، مدیریت mTLS بین سرویس‌ها، circuit breaker ها، retry ها و distributed tracing پیچیده می‌شود. Istio همه اینها را در سطح زیرساخت با sidecar proxy (Envoy) مدیریت می‌کند.

## نصب Istio

\`\`\`bash
curl -L https://istio.io/downloadIstio | sh -
cd istio-1.20.0 && export PATH=$PWD/bin:$PATH

istioctl install --set profile=demo -y

# فعال‌سازی تزریق خودکار sidecar
kubectl label namespace default istio-injection=enabled
\`\`\`

## مدیریت ترافیک

\`\`\`yaml
# کنترل توزیع ترافیک (Canary 10%)
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts: [myapp]
  http:
  - route:
    - destination:
        host: myapp
        subset: v1
      weight: 90
    - destination:
        host: myapp
        subset: v2
      weight: 10
\`\`\`

## mTLS بین سرویس‌ها

\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT  # همه ترافیک باید از mTLS استفاده کند
\`\`\`

## دیباگ

\`\`\`bash
# بررسی تزریق sidecar
kubectl get pod myapp-xxx -o jsonpath='{.spec.containers[*].name}'

# تحلیل مشکلات
istioctl analyze -n production

# داشبورد Kiali
istioctl dashboard kiali
\`\`\`

Istio پیچیدگی عملیاتی قابل توجهی اضافه می‌کند اما در استقرارهای بزرگ microservice که به امنیت، observability و کنترل ترافیک یکپارچه در ده‌ها سرویس نیاز دارید، ارزشش را دارد.
`,
  },
  'github-actions-infrastructure': {
    contentEn: `## Introduction

GitHub Actions is a CI/CD platform that allows you to automate workflows directly in your GitHub repository. For infrastructure engineers, GitHub Actions can automate Terraform deployments, run Ansible playbooks, build Docker images, validate configurations, and enforce security policies — all triggered by code changes. This guide teaches you to build production-grade infrastructure pipelines with GitHub Actions.

## Core Concepts

\`\`\`yaml
# .github/workflows/infra-deploy.yml
name: Infrastructure Deploy

# Triggers: when does this run?
on:
  push:
    branches: [main]
    paths:
      - 'terraform/**'     # Only when terraform files change
  pull_request:
    branches: [main]
    paths:
      - 'terraform/**'
  workflow_dispatch:        # Manual trigger button in UI
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options: [staging, production]

jobs:
  validate:
    name: Validate Terraform
    runs-on: ubuntu-latest  # GitHub-hosted runner

    # Set permissions for this job
    permissions:
      contents: read
      pull-requests: write  # To comment on PRs

    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.6.0"
          cli_config_credentials_token: \${{ secrets.TF_API_TOKEN }}

      - name: Terraform Format Check
        run: terraform fmt -check -recursive
        working-directory: ./terraform

      - name: Terraform Init
        run: terraform init
        working-directory: ./terraform/environments/staging

      - name: Terraform Validate
        run: terraform validate
        working-directory: ./terraform/environments/staging

      - name: Terraform Plan
        id: plan
        run: terraform plan -out=tfplan -no-color
        working-directory: ./terraform/environments/staging
        env:
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Comment Plan on PR
        uses: actions/github-script@v7
        if: github.event_name == 'pull_request'
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          script: |
            const output = \`### Terraform Plan Output
            \`\`\`
            \${{ steps.plan.outputs.stdout }}
            \`\`\`\`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            })
\`\`\`

## Terraform Apply Workflow

\`\`\`yaml
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: validate       # Runs after validate job
    if: github.ref == 'refs/heads/main'  # Only on main branch

    environment:
      name: production    # Requires manual approval in GitHub
      url: https://app.company.com

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Init and Apply
        run: |
          terraform init
          terraform apply -auto-approve -input=false
        working-directory: ./terraform/environments/production
        env:
          TF_VAR_db_password: \${{ secrets.DB_PASSWORD }}
          TF_VAR_api_key: \${{ secrets.EXTERNAL_API_KEY }}
\`\`\`

## Docker Build and Push

\`\`\`yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
    tags: ['v*.*.*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=sha-

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha     # GitHub Actions cache
          cache-to: type=gha,mode=max
\`\`\`

## Security Scanning in CI

\`\`\`yaml
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Scan Terraform for security issues
      - name: Run tfsec
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          soft_fail: false

      # Scan Docker image for CVEs
      - name: Scan Docker image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

      # Check for secrets in code
      - name: Detect secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
\`\`\`

## Ansible Deployment Workflow

\`\`\`yaml
name: Deploy with Ansible

on:
  workflow_dispatch:
    inputs:
      target_hosts:
        description: 'Target hosts pattern'
        default: 'web-servers'
      playbook:
        description: 'Playbook to run'
        default: 'deploy.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH key
        run: |
          mkdir -p ~/.ssh
          echo "\${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H \${{ secrets.BASTION_HOST }} >> ~/.ssh/known_hosts

      - name: Run Ansible Playbook
        uses: dawidd6/action-ansible-playbook@v2
        with:
          playbook: \${{ inputs.playbook }}
          directory: ./ansible
          key: \${{ secrets.DEPLOY_SSH_KEY }}
          inventory: |
            [web-servers]
            web-01.company.com
            web-02.company.com
          options: |
            --extra-vars "version=\${{ github.sha }}"
            --tags deploy
\`\`\`

## Reusable Workflows

\`\`\`yaml
# .github/workflows/reusable-terraform.yml
name: Reusable Terraform

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      tf_directory:
        required: true
        type: string
    secrets:
      AWS_ACCESS_KEY_ID:
        required: true
      AWS_SECRET_ACCESS_KEY:
        required: true

jobs:
  terraform:
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: |
          terraform init
          terraform plan -out=tfplan
          terraform apply tfplan
        working-directory: \${{ inputs.tf_directory }}
        env:
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
\`\`\`

\`\`\`yaml
# Calling the reusable workflow
name: Deploy All Environments

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    uses: ./.github/workflows/reusable-terraform.yml
    with:
      environment: staging
      tf_directory: terraform/environments/staging
    secrets: inherit

  deploy-production:
    uses: ./.github/workflows/reusable-terraform.yml
    needs: deploy-staging
    with:
      environment: production
      tf_directory: terraform/environments/production
    secrets: inherit
\`\`\`

GitHub Actions transforms infrastructure management from manual, error-prone processes into auditable, reproducible pipelines. Start with simple validation workflows, add security scanning, then build full deployment pipelines with approval gates for production.
`,
    contentFa: `## مقدمه

GitHub Actions پلتفرم CI/CD است که به شما اجازه می‌دهد workflow ها را مستقیماً در مخزن GitHub خود اتوماتیک کنید. برای مهندسان زیرساخت، می‌توان استقرارهای Terraform، اجرای playbook های Ansible، ساخت image های Docker و اعمال سیاست‌های امنیتی را اتوماتیک کرد.

## مثال: استقرار Terraform

\`\`\`yaml
name: Infrastructure Deploy

on:
  push:
    branches: [main]
    paths: ['terraform/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - run: terraform fmt -check -recursive
      - run: terraform init && terraform validate
        working-directory: ./terraform/environments/staging

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - run: terraform init && terraform apply -auto-approve
        working-directory: ./terraform/environments/production
\`\`\`

## ساخت Docker Image

\`\`\`yaml
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
\`\`\`

GitHub Actions مدیریت زیرساخت را از فرآیندهای دستی و مستعد خطا به pipeline های قابل ردیابی و تکرارپذیر تبدیل می‌کند.
`,
  },
  'windows-dhcp-dns-enterprise': {
    contentEn: `## Introduction

Windows Server DHCP and DNS are foundational services in enterprise environments. While these services seem simple on the surface, enterprise deployments require careful planning: DHCP failover clustering, DNS scavenging, split-brain DNS for internal vs external resolution, and integration with Active Directory. This guide teaches you to configure and troubleshoot Windows DHCP and DNS for production environments.

## Installing DHCP and DNS Roles

\`\`\`powershell
# Install both roles
Install-WindowsFeature -Name DHCP, DNS -IncludeManagementTools

# For DHCP: authorize server in Active Directory
Add-DhcpServerInDC -DnsName "dhcp01.company.local" -IPAddress 192.168.1.10

# Verify authorization
Get-DhcpServerInDC
\`\`\`

## DHCP Scope Configuration

\`\`\`powershell
# Create DHCP scope for a subnet
Add-DhcpServerv4Scope \`
  -Name "Main Office" \`
  -StartRange 192.168.1.100 \`
  -EndRange 192.168.1.200 \`
  -SubnetMask 255.255.255.0 \`
  -State Active \`
  -LeaseDuration (New-TimeSpan -Days 8)

# Add scope options (default gateway, DNS servers)
Set-DhcpServerv4OptionValue \`
  -ScopeId 192.168.1.0 \`
  -Router 192.168.1.1 \`
  -DnsServer 192.168.1.10, 192.168.1.11 \`
  -DnsDomain "company.local"

# Exclusion range (for static IPs)
Add-DhcpServerv4ExclusionRange \`
  -ScopeId 192.168.1.0 \`
  -StartRange 192.168.1.100 \`
  -EndRange 192.168.1.110

# Reservation for printer (always same IP)
Add-DhcpServerv4Reservation \`
  -ScopeId 192.168.1.0 \`
  -IPAddress 192.168.1.150 \`
  -ClientId "AA-BB-CC-DD-EE-FF" \`
  -Name "Reception-Printer" \`
  -Description "Konica Minolta reception printer"
\`\`\`

## DHCP Failover (High Availability)

\`\`\`powershell
# Configure DHCP failover between two servers
# Run on primary server:
Add-DhcpServerv4Failover \`
  -Name "MainOffice-Failover" \`
  -PartnerServer "dhcp02.company.local" \`
  -ScopeId 192.168.1.0 \`
  -Mode HotStandby \`           # or LoadBalance
  -ServerRole Active \`         # This server is active
  -StandbyScopePercent 5 \`     # 5% held by standby
  -AutoStateTransition $true \` # Auto switch if primary fails
  -MaxClientLeadTime (New-TimeSpan -Hours 2)

# Verify failover
Get-DhcpServerv4Failover
\`\`\`

## DNS Zone Configuration

\`\`\`powershell
# Active Directory-integrated zone (best practice)
Add-DnsServerPrimaryZone \`
  -Name "company.local" \`
  -ReplicationScope "Forest" \`  # Replicate to all DCs in forest
  -DynamicUpdate Secure         # Only AD-authenticated updates

# Add forward lookup records
Add-DnsServerResourceRecordA \`
  -ZoneName "company.local" \`
  -Name "webserver" \`
  -IPv4Address "192.168.1.50"

# Add PTR record (reverse lookup)
Add-DnsServerResourceRecordPTR \`
  -ZoneName "1.168.192.in-addr.arpa" \`
  -Name "50" \`                   # Last octet
  -PtrDomainName "webserver.company.local."

# Add CNAME (alias)
Add-DnsServerResourceRecordCName \`
  -ZoneName "company.local" \`
  -Name "intranet" \`
  -HostNameAlias "webserver.company.local"

# Add MX record for email
Add-DnsServerResourceRecordMX \`
  -ZoneName "company.local" \`
  -Name "@" \`
  -MailExchange "mail.company.local" \`
  -Preference 10
\`\`\`

## Split-Brain DNS (Internal vs External)

Split-brain means different DNS answers for internal and external clients:

\`\`\`powershell
# Internal DNS: company.com resolves to internal IP
Add-DnsServerPrimaryZone -Name "company.com" -ReplicationScope Forest -DynamicUpdate Secure
Add-DnsServerResourceRecordA -ZoneName "company.com" -Name "app" -IPv4Address "10.0.0.50"
# Clients inside network get 10.0.0.50

# External DNS (public): company.com → 203.0.113.50
# Configured on public DNS servers (not Windows Server)
# External clients get 203.0.113.50 → hits NAT → reaches 10.0.0.50
\`\`\`

## DNS Scavenging (Remove Stale Records)

\`\`\`powershell
# Enable scavenging on server
Set-DnsServerScavenging \`
  -ScavengingState $true \`
  -RefreshInterval (New-TimeSpan -Days 7) \`
  -NoRefreshInterval (New-TimeSpan -Days 7) \`
  -ScavengingInterval (New-TimeSpan -Days 7)

# Enable scavenging on specific zone
Set-DnsServerZoneAging \`
  -Name "company.local" \`
  -Aging $true \`
  -RefreshInterval (New-TimeSpan -Days 7) \`
  -NoRefreshInterval (New-TimeSpan -Days 7)

# Manually trigger scavenging now
Start-DnsServerScavenging

# View scavenging timestamps on records
Get-DnsServerResourceRecord -ZoneName "company.local" -Name "oldpc" |
  Select-Object -ExpandProperty RecordData
\`\`\`

## Troubleshooting DHCP Issues

\`\`\`powershell
# Check DHCP server statistics
Get-DhcpServerv4Statistics

# View active leases
Get-DhcpServerv4Lease -ScopeId 192.168.1.0 |
  Where-Object {$_.AddressState -eq "Active"} |
  Select-Object IPAddress, ClientId, HostName, LeaseExpiryTime

# Find a device by MAC address
Get-DhcpServerv4Lease -ScopeId 192.168.1.0 |
  Where-Object {$_.ClientId -eq "AA-BB-CC-DD-EE-FF"}

# Check DHCP conflicts (IPs in use but not leased)
Get-DhcpServerv4Conflict -ScopeId 192.168.1.0

# View DHCP audit log
Get-Content "C:\Windows\System32\dhcp\DhcpSrvLog-Mon.log" | Select-String "AA-BB-CC"
\`\`\`

## Troubleshooting DNS Issues

\`\`\`powershell
# Test DNS resolution
Resolve-DnsName "webserver.company.local" -Server 192.168.1.10

# View DNS debug log
Set-DnsServerDiagnostics -All $true
# Log at: C:\Windows\System32\dns\dns.log

# Check DNS replication between DCs
repadmin /showrepl

# Force DNS zone transfer from primary to secondary
Start-DnsServerZoneTransfer -ZoneName "company.local" -FullTransfer

# Flush DNS cache on server
Clear-DnsServerCache

# Flush DNS cache on client
ipconfig /flushdns

# Test reverse lookup
Resolve-DnsName "192.168.1.50" -Server 192.168.1.10

# Check DNSSEC validation
Resolve-DnsName "company.local" -DnssecOk -Server 192.168.1.10
\`\`\`

## Monitoring DHCP and DNS

\`\`\`powershell
# DHCP scope utilization report
Get-DhcpServerv4ScopeStatistics -ScopeId 192.168.1.0

# Alert when scope is 80% full
$stats = Get-DhcpServerv4ScopeStatistics -ScopeId 192.168.1.0
$utilization = $stats.PercentageInUse
if ($utilization -gt 80) {
    Send-MailMessage -To "ops@company.com" -Subject "DHCP Scope 80% full" \`
      -Body "Scope 192.168.1.0 is $utilization% full" \`
      -SmtpServer "mail.company.local"
}
\`\`\`

Windows DHCP and DNS are mature, reliable services when properly configured. The key best practices: always use AD-integrated zones, configure DHCP failover before you need it, enable scavenging to prevent stale records, and use reservations for devices that need predictable IPs.
`,
    contentFa: `## مقدمه

DHCP و DNS ویندوز سرور سرویس‌های پایه در محیط‌های سازمانی هستند. استقرارهای سازمانی نیازمند برنامه‌ریزی دقیق هستند: DHCP failover clustering، DNS scavenging، split-brain DNS برای resolution داخلی در مقابل خارجی.

## نصب و راه‌اندازی

\`\`\`powershell
Install-WindowsFeature -Name DHCP, DNS -IncludeManagementTools
Add-DhcpServerInDC -DnsName "dhcp01.company.local" -IPAddress 192.168.1.10

# ایجاد scope DHCP
Add-DhcpServerv4Scope -Name "Main Office" \`
  -StartRange 192.168.1.100 -EndRange 192.168.1.200 \`
  -SubnetMask 255.255.255.0 -State Active

# تنظیم گزینه‌های scope
Set-DhcpServerv4OptionValue -ScopeId 192.168.1.0 \`
  -Router 192.168.1.1 -DnsServer 192.168.1.10, 192.168.1.11
\`\`\`

## DHCP Failover

\`\`\`powershell
Add-DhcpServerv4Failover -Name "MainOffice-Failover" \`
  -PartnerServer "dhcp02.company.local" \`
  -ScopeId 192.168.1.0 -Mode HotStandby \`
  -AutoStateTransition $true
\`\`\`

## پیکربندی DNS

\`\`\`powershell
# Zone یکپارچه با Active Directory
Add-DnsServerPrimaryZone -Name "company.local" \`
  -ReplicationScope "Forest" -DynamicUpdate Secure

# اضافه کردن رکورد A
Add-DnsServerResourceRecordA -ZoneName "company.local" \`
  -Name "webserver" -IPv4Address "192.168.1.50"
\`\`\`

## رفع اشکال

\`\`\`powershell
# تست DNS resolution
Resolve-DnsName "webserver.company.local" -Server 192.168.1.10

# مشاهده lease های فعال DHCP
Get-DhcpServerv4Lease -ScopeId 192.168.1.0 | Where-Object {$_.AddressState -eq "Active"}

# پاکسازی cache DNS
ipconfig /flushdns
\`\`\`

DHCP و DNS ویندوز سرویس‌های بالغ و قابل اعتمادی هستند. بهترین روش‌ها: همیشه از zone های یکپارچه با AD استفاده کنید، DHCP failover را قبل از نیاز پیکربندی کنید و scavenging را فعال کنید.
`,
  },
  'windows-file-server-dfs': {
    contentEn: `## Introduction

Windows Server DFS (Distributed File System) provides a unified namespace for file shares across multiple servers, plus replication between sites. Without DFS, users in a branch office must access files across a slow WAN link. With DFS Replication, each site has a local copy of shared folders that stays synchronized. This guide covers DFS Namespaces and DFS Replication for enterprise deployments.

## DFS Namespaces

DFS Namespaces create a virtual folder structure that maps to real shares:

\`\`\`
Without DFS:
\server1\documents    (IT must tell users which server)
\server2\projects

With DFS Namespace:
\company.local\shared\documents   → maps to \server1\documents
\company.local\shared\projects    → maps to \server2\projects
(Users only need to know ONE path)
\`\`\`

\`\`\`powershell
# Install DFS features
Install-WindowsFeature FS-DFS-Namespace, FS-DFS-Replication -IncludeManagementTools

# Create DFS Namespace (Domain-based is recommended)
New-DfsnRoot \`
  -Path "\company.local\shared" \`
  -Type DomainV2 \`
  -TargetPath "\fileserver01\dfsroot" \`
  -Description "Company shared files"

# Add folders to namespace
New-DfsnFolder \`
  -Path "\company.local\shared\documents" \`
  -TargetPath "\fileserver01\documents"

New-DfsnFolder \`
  -Path "\company.local\shared\projects" \`
  -TargetPath "\fileserver02\projects"

# Add redundant targets (automatic failover)
New-DfsnFolderTarget \`
  -Path "\company.local\shared\documents" \`
  -TargetPath "\fileserver02\documents"  # Second copy at another server
\`\`\`

## DFS Replication

\`\`\`powershell
# Create replication group
New-DfsReplicationGroup -GroupName "SharedDocuments"

# Add members (servers that will replicate)
Add-DfsrMember -GroupName "SharedDocuments" -ComputerName "fileserver01"
Add-DfsrMember -GroupName "SharedDocuments" -ComputerName "fileserver02"

# Add replicated folder
Add-DfsrReplicatedFolder \`
  -GroupName "SharedDocuments" \`
  -FolderName "Documents" \`
  -DfsnPath "\company.local\shared\documents"

# Configure folder path on each member
Set-DfsrMembership \`
  -GroupName "SharedDocuments" \`
  -FolderName "Documents" \`
  -ComputerName "fileserver01" \`
  -ContentPath "D:\Shares\Documents" \`
  -PrimaryMember $true  # Primary owns initial sync

Set-DfsrMembership \`
  -GroupName "SharedDocuments" \`
  -FolderName "Documents" \`
  -ComputerName "fileserver02" \`
  -ContentPath "D:\Shares\Documents" \`
  -PrimaryMember $false

# Set replication topology (full mesh or hub-and-spoke)
Add-DfsrConnection \`
  -GroupName "SharedDocuments" \`
  -SourceComputerName "fileserver01" \`
  -DestinationComputerName "fileserver02"
\`\`\`

## Monitoring DFS Replication

\`\`\`powershell
# Check replication backlog (how many files waiting to sync)
Get-DfsrBacklog \`
  -GroupName "SharedDocuments" \`
  -FolderName "Documents" \`
  -SourceComputerName "fileserver01" \`
  -DestinationComputerName "fileserver02" \`
  -Verbose

# Get replication state
Get-DfsReplicatedFolder -GroupName "SharedDocuments"

# Check replication partner status
Get-DfsrConnection -GroupName "SharedDocuments"

# DFS Replication health report
Get-DfsrMembership -GroupName "SharedDocuments" |
  Select-Object ComputerName, FolderName, LastSyncTime, State
\`\`\`

## File Server Permissions

\`\`\`powershell
# Create share with proper permissions
New-SmbShare \`
  -Name "Documents" \`
  -Path "D:\Shares\Documents" \`
  -FullAccess "COMPANY\FileAdmins" \`
  -ChangeAccess "COMPANY\Domain Users" \`
  -ReadAccess "COMPANY\Contractors" \`
  -Description "Shared documents"

# NTFS permissions (more granular)
$acl = Get-Acl "D:\Shares\Documents"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "COMPANY\HRTeam",
    "FullControl",
    "ContainerInherit,ObjectInherit",
    "None",
    "Allow"
)
$acl.AddAccessRule($rule)
Set-Acl "D:\Shares\Documents\HR" $acl

# Enable Access-Based Enumeration (users only see folders they can access)
Set-SmbShare -Name "Documents" -FolderEnumerationMode AccessBased
\`\`\`

## Shadow Copies (Previous Versions)

\`\`\`powershell
# Enable shadow copies on volume
$job = Register-WmiObject -Namespace root\cimv2 \`
  -Class Win32_ShadowCopy

# Using vssadmin
vssadmin add shadowstorage /For=D: /On=D: /MaxSize=10%
vssadmin create shadow /For=D:

# Schedule shadow copies via Task Scheduler
# Or use: Set-ItemProperty on Windows Server
# Typically done via GUI: Computer Management → Shared Folders →
# Right-click volume → Configure Shadow Copies

# List shadow copies
vssadmin list shadows /For=D:
\`\`\`

## File Server Troubleshooting

\`\`\`powershell
# Check who has files open
Get-SmbOpenFile | Where-Object {$_.ShareName -eq "Documents"}

# Force close open file
Close-SmbOpenFile -FileId 12345678 -Force

# Check share permissions
Get-SmbShareAccess -Name "Documents"

# Test DFS path resolution
dfsutil target \company.local\shared\documents

# DFS namespace health
dfsdiag /testdcs /domain:company.local
dfsdiag /testnamespace /root:\company.local\shared /recurse /full

# Fix DFS replication conflict folder
# Conflicts stored in: D:\Shares\Documents\DfsrPrivate\ConflictAndDeletedGet-ChildItem "D:\Shares\Documents\DfsrPrivate\ConflictAndDeleted" |
  Select-Object Name, LastWriteTime, Length
\`\`\`

DFS Namespaces and Replication are essential for multi-site file sharing. The key insight: DFS Namespace gives users a consistent path regardless of where files actually live, while DFS Replication keeps those files synchronized — together they provide both high availability and geographic distribution of files.
`,
    contentFa: `## مقدمه

DFS ویندوز سرور یک namespace یکپارچه برای file share ها در چندین سرور فراهم می‌کند، به علاوه replication بین سایت‌ها. با DFS Replication، هر سایت یک کپی محلی از پوشه‌های مشترک دارد که همگام‌سازی می‌شود.

## DFS Namespace

\`\`\`powershell
Install-WindowsFeature FS-DFS-Namespace, FS-DFS-Replication -IncludeManagementTools

# ایجاد Namespace
New-DfsnRoot -Path "\company.local\shared" -Type DomainV2 \`
  -TargetPath "\fileserver01\dfsroot"

# اضافه کردن پوشه‌ها
New-DfsnFolder -Path "\company.local\shared\documents" \`
  -TargetPath "\fileserver01\documents"
\`\`\`

## DFS Replication

\`\`\`powershell
New-DfsReplicationGroup -GroupName "SharedDocuments"
Add-DfsrMember -GroupName "SharedDocuments" -ComputerName "fileserver01"
Add-DfsrMember -GroupName "SharedDocuments" -ComputerName "fileserver02"

Set-DfsrMembership -GroupName "SharedDocuments" \`
  -FolderName "Documents" -ComputerName "fileserver01" \`
  -ContentPath "D:\Shares\Documents" -PrimaryMember $true
\`\`\`

## پایش Replication

\`\`\`powershell
# بررسی backlog (چه تعداد فایل در انتظار sync)
Get-DfsrBacklog -GroupName "SharedDocuments" \`
  -FolderName "Documents" \`
  -SourceComputerName "fileserver01" \`
  -DestinationComputerName "fileserver02"
\`\`\`

DFS Namespace مسیر یکپارچه‌ای برای کاربران فراهم می‌کند صرف‌نظر از اینکه فایل‌ها واقعاً کجا باشند، در حالی که DFS Replication آن فایل‌ها را همگام‌سازی نگه می‌دارد.
`,
  },
  'hyper-v-cluster-setup': {
    contentEn: `## Introduction

Hyper-V Failover Clustering provides high availability for virtual machines — when a Hyper-V host fails, its VMs automatically restart on surviving hosts. This is essential for production workloads where downtime is unacceptable. This guide covers building a Hyper-V cluster from physical servers to running highly available VMs.

## Prerequisites

- Minimum 2 servers (nodes) with Windows Server 2019/2022 Datacenter
- Shared storage: iSCSI SAN, Fibre Channel, or Storage Spaces Direct (S2D)
- Two network interfaces per node (production + cluster communication)
- All nodes domain-joined

## Installing Hyper-V and Failover Clustering

\`\`\`powershell
# Run on ALL nodes
Install-WindowsFeature -Name Hyper-V, Failover-Clustering -IncludeManagementTools -Restart

# After restart: validate cluster configuration
Test-Cluster -Node "hv01.company.local", "hv02.company.local" \`
  -Include "Storage Spaces Direct", "Inventory", "Network", "System Configuration"
# Review the report! Fix any errors before creating cluster.
\`\`\`

## Creating the Cluster

\`\`\`powershell
# Create cluster with static IP
New-Cluster \`
  -Name "HVCluster01" \`
  -Node "hv01.company.local", "hv02.company.local" \`
  -StaticAddress 192.168.1.20 \`
  -NoStorage  # Add storage separately

# Configure cluster quorum
# For 2 nodes: need file share witness or Azure Cloud Witness
Set-ClusterQuorum -FileShareWitness "\witness-server\hv-quorum"

# Verify cluster
Get-Cluster
Get-ClusterNode
\`\`\`

## Configuring Cluster Networks

\`\`\`powershell
# Rename cluster networks for clarity
(Get-ClusterNetwork | Where-Object {$_.Address -eq "192.168.1.0"}).Name = "Production"
(Get-ClusterNetwork | Where-Object {$_.Address -eq "192.168.100.0"}).Name = "Cluster"

# Production network: allow client access
(Get-ClusterNetwork "Production").Role = 3  # 3 = Client+Cluster

# Cluster network: cluster communication only (not client traffic)
(Get-ClusterNetwork "Cluster").Role = 1     # 1 = Cluster only
\`\`\`

## Adding Shared Storage

\`\`\`powershell
# Option A: iSCSI storage
# Connect to iSCSI target from each node first
Start-Service msiscsi
Set-Service msiscsi -StartupType Automatic
New-IscsiTargetPortal -TargetPortalAddress "192.168.100.50"
Connect-IscsiTarget -NodeAddress "iqn.2020-01.com.company:storage01"

# Initialize and format shared disk (run once, on one node)
Initialize-Disk -Number 1 -PartitionStyle GPT
New-Partition -DiskNumber 1 -UseMaximumSize -AssignDriveLetter
Format-Volume -DriveLetter E -FileSystem NTFS -NewFileSystemLabel "ClusterStorage"

# Add disk to cluster
Get-ClusterAvailableDisk | Add-ClusterDisk

# Option B: Storage Spaces Direct (S2D)
Enable-ClusterStorageSpacesDirect -CacheState Disabled

# Create virtual disk on S2D
New-Volume -StoragePoolFriendlyName "S2D on HVCluster01" \`
  -FriendlyName "VMs-Volume01" \`
  -FileSystem CSVFS_ReFS \`
  -StorageTierFriendlyNames Performance, Capacity \`
  -StorageTierSizes 100GB, 500GB
\`\`\`

## Creating Highly Available VMs

\`\`\`powershell
# Create VM on cluster shared volume
$VMPath = "C:\ClusterStorage\VMs-Volume01"

New-VM \`
  -Name "WebServer01" \`
  -MemoryStartupBytes 4GB \`
  -VHDPath "$VMPath\WebServer01\WebServer01.vhdx" \`
  -NewVHDSizeBytes 80GB \`
  -SwitchName "Production" \`
  -Path "$VMPath"

# Configure VM
Set-VM -Name "WebServer01" \`
  -ProcessorCount 4 \`
  -DynamicMemory $true \`
  -MemoryMinimumBytes 2GB \`
  -MemoryMaximumBytes 16GB

# Make VM highly available
Add-ClusterVirtualMachineRole -VMName "WebServer01"

# Verify HA status
Get-ClusterGroup "WebServer01"
\`\`\`

## Live Migration

\`\`\`powershell
# Move VM to specific node (no downtime)
Move-ClusterVirtualMachineRole \`
  -Name "WebServer01" \`
  -Node "hv02.company.local" \`
  -MigrationType Live

# Drain a node for maintenance
Suspend-ClusterNode -Name "hv01.company.local" -Drain

# After maintenance: resume
Resume-ClusterNode -Name "hv01.company.local"
\`\`\`

## Monitoring Cluster Health

\`\`\`powershell
# Overall cluster status
Get-ClusterNode | Select-Object Name, State, NodeWeight
Get-ClusterGroup | Select-Object Name, OwnerNode, State

# Check for cluster events
Get-ClusterLog -Destination C:\Logs
# VM placement report
Get-ClusterGroup | Where-Object {$_.GroupType -eq "VirtualMachine"} |
  Select-Object Name, OwnerNode, State |
  Sort-Object OwnerNode

# Disk health
Get-PhysicalDisk | Select-Object FriendlyName, HealthStatus, OperationalStatus, Size
\`\`\`

## Automated VM Balancing

\`\`\`powershell
# Enable VM load balancing (auto-migrate VMs for even distribution)
(Get-Cluster).AutoBalancerMode = 2     # 2 = Balance when node joins
(Get-Cluster).AutoBalancerLevel = 1   # 1 = Low aggressiveness

# Anti-affinity (keep VMs on different nodes)
# Useful to prevent all web servers landing on same host
New-ClusterAffinityRule -Name "WebServers-AntiAffinity" -Ruletype SameFaultDomain
Add-ClusterGroupToAffinityRule -Name "WebServers-AntiAffinity" -Groups "WebServer01", "WebServer02"
\`\`\`

Hyper-V clustering transforms individual servers into a resilient platform where VMs can survive host failures. The most important skills: understanding quorum (the mechanism that prevents split-brain), mastering Live Migration for maintenance, and knowing how to drain nodes gracefully.
`,
    contentFa: `## مقدمه

Hyper-V Failover Clustering برای ماشین‌های مجازی high availability فراهم می‌کند - وقتی یک Hyper-V host شکست می‌خورد، VM های آن به‌طور خودکار روی host های باقی‌مانده راه‌اندازی مجدد می‌شوند.

## نصب

\`\`\`powershell
# روی همه node ها اجرا کنید
Install-WindowsFeature -Name Hyper-V, Failover-Clustering -IncludeManagementTools -Restart

# اعتبارسنجی پیکربندی cluster
Test-Cluster -Node "hv01.company.local", "hv02.company.local" \`
  -Include "Storage", "Network", "System Configuration"
\`\`\`

## ایجاد Cluster

\`\`\`powershell
New-Cluster -Name "HVCluster01" \`
  -Node "hv01.company.local", "hv02.company.local" \`
  -StaticAddress 192.168.1.20 -NoStorage

# تنظیم quorum برای ۲ node
Set-ClusterQuorum -FileShareWitness "\witness-server\hv-quorum"
\`\`\`

## ایجاد VM با High Availability

\`\`\`powershell
New-VM -Name "WebServer01" -MemoryStartupBytes 4GB \`
  -VHDPath "C:\ClusterStorage\VMs\WebServer01.vhdx" \`
  -NewVHDSizeBytes 80GB -SwitchName "Production"

# تبدیل به HA
Add-ClusterVirtualMachineRole -VMName "WebServer01"
\`\`\`

## Live Migration

\`\`\`powershell
# انتقال VM بدون downtime
Move-ClusterVirtualMachineRole -Name "WebServer01" \`
  -Node "hv02.company.local" -MigrationType Live

# آماده‌سازی node برای تعمیرات
Suspend-ClusterNode -Name "hv01.company.local" -Drain
\`\`\`

مهم‌ترین مهارت‌ها: درک quorum، تسلط بر Live Migration برای تعمیرات و دانستن چگونگی drain کردن node ها به‌صورت graceful.
`,
  },
  'azure-ad-connect-hybrid': {
    contentEn: `## Introduction

Azure AD Connect (now Microsoft Entra Connect) synchronizes your on-premises Active Directory with Azure Active Directory (Entra ID), enabling hybrid identity — users sign in to cloud services (Microsoft 365, Azure) using their on-premises AD credentials. This guide covers deploying, configuring, and troubleshooting Azure AD Connect in enterprise environments.

## Architecture Options

**Password Hash Synchronization (PHS)** — Recommended for most:
\`\`\`
On-premises AD → Azure AD Connect → Azure AD (Entra ID)
- Syncs password hashes (not plaintext passwords)
- Users authenticate directly to Azure AD
- Works even if on-premises is down
\`\`\`

**Pass-Through Authentication (PTA)**:
\`\`\`
On-premises AD → Azure AD Connect → Azure AD
- Authentication agent passes credentials to on-premises AD
- Real-time on-premises policy enforcement
- Requires on-premises to be available
\`\`\`

**Federation with AD FS**:
\`\`\`
On-premises AD → AD FS → Azure AD
- Complex but maximum control
- SSO using Kerberos on domain-joined machines
- Requires AD FS infrastructure
\`\`\`

## Installing Azure AD Connect

\`\`\`
Prerequisites:
- Windows Server 2019 (dedicated server recommended)
- .NET Framework 4.7.2+
- Domain Admin credentials for on-premises AD
- Global Admin credentials for Azure AD/Microsoft 365
- Port 443 outbound to *.microsoftonline.com
\`\`\`

\`\`\`powershell
# Check prerequisites before installing
# Verify .NET version
[System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()

# Check TLS 1.2 is enabled
[Net.ServicePointManager]::SecurityProtocol

# Download and run Microsoft Entra Connect installer
# installer.microsoft.com/download/details/miid=47594
# Follow wizard: Use Express settings for simple deployments
\`\`\`

Express settings configuration:
\`\`\`
1. Connect to Azure AD: Global Admin credentials
2. Connect to AD DS: Domain Admin for COMPANY\Administrator
3. Azure AD sign-in configuration:
   - Verify your domain is verified in Azure AD
   - Select UPN suffix: user@company.com (not user@company.local)
4. Ready to configure: Enable synchronization
\`\`\`

## Configuring Synchronization Rules

\`\`\`powershell
# After installation: view sync rules
Get-ADSyncRule | Select-Object Name, Direction, Priority | Sort-Object Priority

# Custom sync rule: sync additional attributes
# Open Synchronization Rules Editor (GUI)
# Or use PowerShell:
$rule = New-ADSyncRule \`
  -Name "In from AD - User Department Sync" \`
  -Direction Inbound \`
  -ConnectorName "COMPANY.LOCAL" \`
  -LinkType Join

# Add transformation
$transformation = New-ADSyncTransformation \`
  -TransformationType Direct \`
  -SourceAttribute "department" \`
  -DestinationAttribute "department" \`
  -FlowType Import

Add-ADSyncRuleTransformation -Rule $rule -Transformation $transformation
Add-ADSyncRule $rule
\`\`\`

## OU Filtering (Sync Only Specific OUs)

\`\`\`powershell
# Configure which OUs to sync
# Exclude service accounts, disabled users, etc.
Set-ADSyncDomainJoiningFilter -ConnectorName "COMPANY.LOCAL" \`
  -ADObjectTypeFilters @{
    User      = @("OU=Employees,DC=company,DC=local", "OU=Contractors,DC=company,DC=local")
    Group     = @("OU=Security Groups,DC=company,DC=local")
    Computer  = @()  # Don't sync computers
  }

# Trigger sync after configuration change
Start-ADSyncSyncCycle -PolicyType Delta   # Delta = only changes
Start-ADSyncSyncCycle -PolicyType Initial  # Full sync
\`\`\`

## Monitoring Sync Status

\`\`\`powershell
# Check last sync result
Get-ADSyncScheduler
# Returns:
# SyncCycleEnabled     : True
# NextSyncCyclePolicyType : Delta
# NextSyncCycleStartTimeInUTC : 6/1/2024 2:30:00 PM

# Check for sync errors
Get-ADSyncCSObject -ConnectorName "COMPANY.LOCAL" -Filter { ErrorCode -ne 0 } |
  Select-Object DN, ErrorCode, ErrorMessage | Format-List

# View Azure AD sync errors (PowerShell)
Connect-MsolService
Get-MsolDirSyncProvisioningError -ErrorCategory PropertyConflict |
  Select-Object UserPrincipalName, ObjectId, PropertyName, PropertyValue

# Health monitoring: install and check
Import-Module ADSyncDiagnostics
Invoke-ADSyncDiagnostics
\`\`\`

## Common Issues and Fixes

\`\`\`powershell
# Issue: UPN suffix mismatch (user@company.local vs user@company.com)
# Fix: Set alternate login ID
Set-ADSyncAuthenticationPolicy -AlternateIdAttribute mail

# Issue: Duplicate attributes (samaccountname conflicts)
# Find and fix in Azure AD portal under Sync → Errors

# Issue: Object not syncing (stuck in staging)
# Force re-sync specific object
Invoke-ADSyncCSObjectPasswordHashSync -DistinguishedName "CN=John Smith,OU=Employees,DC=company,DC=local"

# Issue: Password writeback not working
# Enable password writeback feature
$connector = Get-ADSyncConnector -Name "COMPANY.LOCAL"
$connector.Attributes["PasswordManagementEnabled"] = "true"

# Issue: Sync stopped
# Restart the service
Restart-Service ADSync

# Check ADConnect server event log
Get-EventLog -LogName Application -Source "Directory Synchronization" -Newest 20
\`\`\`

## Hybrid Azure AD Join

\`\`\`powershell
# Enable computer sync (allow Windows 10/11 to register in Azure AD)
# In Azure AD Connect: Configure → Configure device options
# Enable: Hybrid Azure AD join

# Verify joined devices
dsregcmd /status
# Look for:
# AzureAdJoined: YES
# DomainJoined: YES

# Check device registration on Azure AD portal
Get-MsolDevice -All | Where-Object {$_.DeviceTrustType -eq "ServerAd"}
\`\`\`

Azure AD Connect is the foundation of hybrid identity. Keep it healthy: monitor sync errors daily, keep it updated (new versions fix security issues), and test password writeback before enabling self-service password reset for users.
`,
    contentFa: `## مقدمه

Azure AD Connect (اکنون Microsoft Entra Connect) Active Directory محلی شما را با Azure Active Directory همگام‌سازی می‌کند و هویت hybrid را فعال می‌کند - کاربران با اعتبارنامه‌های AD محلی خود به سرویس‌های ابری وارد می‌شوند.

## گزینه‌های معماری

- **Password Hash Synchronization**: توصیه‌شده برای اکثر سازمان‌ها، hash رمز عبور را sync می‌کند
- **Pass-Through Authentication**: احراز هویت از طریق agent به AD محلی منتقل می‌شود
- **Federation با AD FS**: پیچیده‌ترین اما بیشترین کنترل

## نصب و پیکربندی

\`\`\`powershell
# بررسی وضعیت sync
Get-ADSyncScheduler

# بررسی خطاهای sync
Get-ADSyncCSObject -ConnectorName "COMPANY.LOCAL" -Filter { ErrorCode -ne 0 }

# ایجاد sync دستی
Start-ADSyncSyncCycle -PolicyType Delta   # تغییرات جدید
Start-ADSyncSyncCycle -PolicyType Initial  # sync کامل
\`\`\`

## فیلتر کردن OU ها

\`\`\`powershell
Set-ADSyncDomainJoiningFilter -ConnectorName "COMPANY.LOCAL" \`
  -ADObjectTypeFilters @{
    User  = @("OU=Employees,DC=company,DC=local")
    Group = @("OU=Security Groups,DC=company,DC=local")
  }
\`\`\`

## مشکلات رایج

\`\`\`powershell
# راه‌اندازی مجدد سرویس sync
Restart-Service ADSync

# رویدادهای log اپلیکیشن
Get-EventLog -LogName Application -Source "Directory Synchronization" -Newest 20
\`\`\`

Azure AD Connect پایه هویت hybrid است. خطاهای sync را روزانه پایش کنید و آن را به‌روز نگه دارید.
`,
  },
  'ipv6-enterprise-deployment': {
    contentEn: `## Introduction

IPv6 is no longer optional — with IPv4 exhaustion, many internet paths now prefer IPv6, and cloud providers assign IPv6 by default. Enterprise networks lagging on IPv6 face connectivity issues, security blind spots (IPv6 traffic bypassing IPv4-only security controls), and increased complexity. This guide teaches you to deploy IPv6 alongside IPv4 (dual-stack) in enterprise environments.

## Understanding IPv6 Address Types

\`\`\`
IPv6 addresses are 128-bit, written as 8 groups of 4 hex digits:
2001:0db8:85a3:0000:0000:8a2e:0370:7334

Shortened forms:
- Leading zeros omitted: 2001:db8:85a3:0:0:8a2e:370:7334
- :: replaces ONE consecutive group of zeros: 2001:db8:85a3::8a2e:370:7334

Address types:
- Global Unicast (GUA): 2000::/3 — Public internet addresses (like IPv4 public)
- Link-Local:     fe80::/10 — Auto-configured, non-routable, per interface
- Unique Local:   fc00::/7  — Private addresses (like 192.168.x.x in IPv4)
- Multicast:      ff00::/8  — Group addresses (replaces broadcast)

/64 is the standard subnet size for most LANs (allows SLAAC)
/48 is typically assigned to a site by ISP
/32 is typically assigned to a large organization
\`\`\`

## Planning IPv6 Addressing

\`\`\`
Example enterprise IPv6 plan with /48 from ISP: 2001:db8:1234::/48

Subnets (/64 each from the /48):
2001:db8:1234:0001::/64  → Main office VLAN 10 (management)
2001:db8:1234:0002::/64  → Main office VLAN 20 (servers)
2001:db8:1234:0003::/64  → Main office VLAN 30 (users)
2001:db8:1234:0010::/64  → Branch office 1
2001:db8:1234:0020::/64  → Branch office 2
2001:db8:1234:ffff::/64  → DMZ

Each /64 has 18 quintillion addresses — never worry about exhaustion
\`\`\`

## Configuring IPv6 on Linux

\`\`\`bash
# Check current IPv6 addresses
ip -6 addr show

# Add static IPv6 address
ip -6 addr add 2001:db8:1234:2::10/64 dev eth0
ip -6 route add default via 2001:db8:1234:2::1 dev eth0

# Permanent configuration (Ubuntu/Debian netplan)
# /etc/netplan/00-netcfg.yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - 192.168.1.10/24
        - 2001:db8:1234:2::10/64
      gateway4: 192.168.1.1
      gateway6: 2001:db8:1234:2::1
      nameservers:
        addresses: [192.168.1.10, 2001:db8:1234:2::10]

# Apply
netplan apply

# Test IPv6 connectivity
ping6 2001:db8:1234:2::1
ping6 google.com  # Tests full IPv6 internet
traceroute6 google.com
\`\`\`

## Configuring IPv6 on Windows Server

\`\`\`powershell
# View IPv6 interfaces
Get-NetIPAddress -AddressFamily IPv6

# Add static IPv6 address
New-NetIPAddress \`
  -InterfaceAlias "Ethernet" \`
  -IPAddress "2001:db8:1234:2::11" \`
  -PrefixLength 64 \`
  -DefaultGateway "2001:db8:1234:2::1"

# Add IPv6 DNS servers
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" \`
  -ServerAddresses ("2001:db8:1234:2::10", "2001:db8:1234:2::11")

# Test
Test-NetConnection -ComputerName "ipv6.google.com" -Port 80
\`\`\`

## Cisco Router/Switch IPv6 Configuration

\`\`\`
! Enable IPv6 routing
ipv6 unicast-routing

! Configure interface
interface GigabitEthernet0/0
 ipv6 address 2001:db8:1234:2::1/64
 ipv6 enable
 no shutdown

! Enable Router Advertisement (required for SLAAC)
! RA messages tell hosts the prefix for auto-configuration
interface GigabitEthernet0/0
 ipv6 nd prefix 2001:db8:1234:2::/64 14400 3600

! Static IPv6 route
ipv6 route 2001:db8:1234:3::/64 2001:db8:1234:2::2

! OSPFv3 for IPv6 dynamic routing
ipv6 router ospf 1
 router-id 1.1.1.1

interface GigabitEthernet0/0
 ipv6 ospf 1 area 0
\`\`\`

## DHCPv6 for Enterprise Addressing

SLAAC (Stateless Address Autoconfiguration) handles addressing automatically, but for DNS and other options use DHCPv6:

\`\`\`
# Windows Server DHCPv6 scope
Add-DhcpServerv6Scope \`
  -Name "Users VLAN" \`
  -Prefix "2001:db8:1234:3::" \`
  -State Active \`
  -PreferredLifetime (New-TimeSpan -Days 8) \`
  -ValidLifetime (New-TimeSpan -Days 30)

Set-DhcpServerv6OptionValue \`
  -Prefix "2001:db8:1234:3::" \`
  -DnsServer "2001:db8:1234:2::10", "2001:db8:1234:2::11" \`
  -DomainSearchList "company.local"
\`\`\`

## IPv6 Security Considerations

\`\`\`bash
# IPv6 firewall rules (ip6tables on Linux)
# Default policy: drop
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP
ip6tables -P OUTPUT ACCEPT

# Allow established/related
ip6tables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow ICMPv6 (required for IPv6 to function!)
ip6tables -A INPUT -p icmpv6 -j ACCEPT

# Allow SSH
ip6tables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow from internal network
ip6tables -A INPUT -s 2001:db8:1234::/48 -j ACCEPT

# Critical: Block router advertisement flooding (RA Guard)
# Configure on switches to prevent rogue RA messages
# Cisco IOS:
# ipv6 nd raguard policy HOST
#   device-role host
# interface range GigabitEthernet0/1-24
#  ipv6 nd raguard attach-policy HOST
\`\`\`

## Testing IPv6 Connectivity

\`\`\`bash
# Test from Linux
ping6 -c 4 2001:db8:1234:2::1
traceroute6 2001:4860:4860::8888  # Google DNS IPv6

# From Windows
ping -6 2001:db8:1234:2::1
tracert -6 ipv6.google.com

# Test dual-stack website
curl -6 https://ipv6.google.com
curl -4 https://google.com  # Force IPv4

# Check which address is preferred (dual-stack)
curl https://ip.me   # Should return your IPv6 address

# Online tools
# test-ipv6.com - comprehensive IPv6 connectivity test
\`\`\`

IPv6 deployment follows a simple rule: deploy dual-stack (IPv4 and IPv6 simultaneously), never IPv6-only until everything supports it. Start with servers and network equipment, then roll out to end-user devices. Enable IPv6 filtering from day one — don't let IPv6 traffic bypass your security controls.
`,
    contentFa: `## مقدمه

IPv6 دیگر اختیاری نیست - با اتمام IPv4، بسیاری از مسیرهای اینترنتی اکنون IPv6 را ترجیح می‌دهند. این راهنما استقرار IPv6 در کنار IPv4 (dual-stack) در محیط‌های سازمانی را آموزش می‌دهد.

## پیکربندی Linux

\`\`\`bash
# آدرس‌دهی IPv6 با netplan
network:
  ethernets:
    eth0:
      addresses:
        - 192.168.1.10/24
        - 2001:db8:1234:2::10/64
      gateway6: 2001:db8:1234:2::1

# تست اتصال
ping6 2001:db8:1234:2::1
traceroute6 google.com
\`\`\`

## پیکربندی Cisco

\`\`\`
ipv6 unicast-routing

interface GigabitEthernet0/0
 ipv6 address 2001:db8:1234:2::1/64
 ipv6 enable
 ipv6 nd prefix 2001:db8:1234:2::/64 14400 3600
\`\`\`

## امنیت IPv6

\`\`\`bash
# قوانین فایروال (ip6tables)
ip6tables -P INPUT DROP
ip6tables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
ip6tables -A INPUT -p icmpv6 -j ACCEPT  # ICMPv6 برای عملکرد IPv6 ضروری است
\`\`\`

استقرار IPv6 از یک قانون ساده پیروی می‌کند: dual-stack (IPv4 و IPv6 به‌صورت همزمان) پیاده‌سازی کنید. از ابتدا فیلترینگ IPv6 را فعال کنید.
`,
  },
  '8021x-nac-wired-wireless': {
    contentEn: `## Introduction

802.1X is the IEEE standard for port-based network access control. It prevents unauthorized devices from connecting to your network by requiring authentication before granting network access — on wired ports (switches) and wireless (Wi-Fi). This guide covers deploying 802.1X authentication using RADIUS (FreeRADIUS or Windows NPS) for both wired and wireless networks.

## How 802.1X Works

\`\`\`
Device (Supplicant)  →  Switch/AP (Authenticator)  →  RADIUS Server (Auth Server)
        │                          │                            │
        │──── EAP Start ──────────►│                            │
        │                          │──── RADIUS Access-Request ►│
        │◄─── EAP Identity ────────│◄─── RADIUS Access-Challenge│
        │──── Username ───────────►│──── RADIUS Access-Request ►│
        │                          │◄─── RADIUS Access-Accept ──│
        │◄─── Network Access ──────│                            │
\`\`\`

## Setting Up FreeRADIUS

\`\`\`bash
# Install FreeRADIUS
sudo apt install freeradius freeradius-utils

# Configure clients (authenticators: switches, APs)
sudo nano /etc/freeradius/3.0/clients.conf
\`\`\`

\`\`\`
# /etc/freeradius/3.0/clients.conf
client cisco-switch-01 {
    ipaddr = 192.168.1.1
    secret = SharedSecretKey123!
    shortname = sw01
    nastype = cisco
}

client wifi-ap-01 {
    ipaddr = 192.168.1.2
    secret = WifiSharedSecret456!
    shortname = ap01
    nastype = other
}
\`\`\`

Configure users/Active Directory integration:
\`\`\`bash
# /etc/freeradius/3.0/mods-enabled/ldap
ldap {
    server = "192.168.1.10"
    port = 389
    identity = "CN=radius-svc,OU=Service Accounts,DC=company,DC=local"
    password = "RadiusServicePass!"
    base_dn = "DC=company,DC=local"
    user {
        base_dn = "\${..base_dn}"
        filter = "(sAMAccountName=%{%{Stripped-User-Name}:-%{User-Name}})"
    }
}
\`\`\`

\`\`\`bash
# Test FreeRADIUS configuration
sudo freeradius -X  # Debug mode - shows all packets

# Test authentication
radtest username password 127.0.0.1 0 testing123

# Check certificate for EAP-TLS
openssl verify -CAfile /etc/freeradius/3.0/certs/ca.pem     /etc/freeradius/3.0/certs/server.pem
\`\`\`

## Cisco Switch 802.1X Configuration

\`\`\`
! Enable 802.1X globally
aaa new-model
aaa authentication dot1x default group radius
aaa authorization network default group radius
aaa accounting dot1x default start-stop group radius

! Configure RADIUS server
radius server NPS-01
  address ipv4 192.168.1.10 auth-port 1812 acct-port 1813
  key SharedSecretKey123!

dot1x system-auth-control

! Configure access port
interface GigabitEthernet1/0/1
  switchport mode access
  switchport access vlan 10
  dot1x port-control auto          ! Require 802.1X
  dot1x timeout quiet-period 10
  dot1x max-reauth-req 2
  spanning-tree portfast
  authentication event fail action authorize vlan 99  ! Guest VLAN on failure
  authentication event no-response action authorize vlan 99
\`\`\`

## Dynamic VLAN Assignment

RADIUS can assign VLANs dynamically based on user/device identity:

\`\`\`
# FreeRADIUS policy: assign VLAN based on AD group
# /etc/freeradius/3.0/policy.d/vlan-assignment
if (LDAP-Group == "IT-Staff") {
    reply:Tunnel-Type = VLAN
    reply:Tunnel-Medium-Type = IEEE-802
    reply:Tunnel-Private-Group-Id = "20"   # IT VLAN
}
elsif (LDAP-Group == "Finance") {
    reply:Tunnel-Type = VLAN
    reply:Tunnel-Medium-Type = IEEE-802
    reply:Tunnel-Private-Group-Id = "30"   # Finance VLAN
}
else {
    reply:Tunnel-Type = VLAN
    reply:Tunnel-Medium-Type = IEEE-802
    reply:Tunnel-Private-Group-Id = "99"   # Guest VLAN
}
\`\`\`

## Windows NPS (Network Policy Server)

Windows NPS is the Microsoft RADIUS server, ideal if you use Active Directory:

\`\`\`
NPS Setup:
1. Server Manager → Add Roles → Network Policy and Access Services
2. NPS Console → RADIUS Clients and Servers → RADIUS Clients
   → New Client:
     Name: cisco-switch-01
     Address: 192.168.1.1
     Shared secret: SharedSecretKey123!

3. Network Policies → New Policy:
   Name: "802.1X Wired Access"
   Conditions:
     - NAS-Port-Type = Ethernet
     - Windows Groups = COMPANY\All Employees
   Settings:
     - Authentication: Protected EAP (PEAP)
     - MS-CHAP v2 (for AD password auth)
\`\`\`

## Wireless 802.1X (WPA2-Enterprise)

\`\`\`
# Cisco Wireless LAN Controller configuration
wlan 802.1x-corp 1 Corp-WiFi
  security wpa akm dot1x
  security wpa wpa2 ciphers aes
  radius server auth add 192.168.1.10 1812 key SharedSecret
  no shutdown

# Client configuration (Windows):
# Network Settings → Properties → Security:
# Authentication: WPA2-Enterprise
# Encryption: AES
# EAP method: PEAP
# Inner method: MS-CHAP v2
# Use Windows credentials: Yes (SSO with AD)
\`\`\`

## Certificate-Based Authentication (EAP-TLS)

\`\`\`bash
# Create CA and certificates for EAP-TLS
cd /etc/freeradius/3.0/certs

# Generate CA (Certificate Authority)
openssl req -new -x509 -keyout ca.key -out ca.pem -days 3650   -subj "/C=US/O=Company/CN=Company CA"

# Generate server certificate for RADIUS
openssl req -new -keyout server.key -out server.csr   -subj "/C=US/O=Company/CN=radius.company.com"
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key   -out server.pem -days 3650

# Generate client certificate for device authentication
openssl req -new -keyout client.key -out client.csr   -subj "/C=US/O=Company/CN=laptop01.company.com"
openssl x509 -req -in client.csr -CA ca.pem -CAkey ca.key   -out client.pem -days 3650

# Install client certificate via GPO on Windows
# Computer Configuration → Windows Settings → Security Settings
# → Public Key Policies → Certificate Services Client - Auto-Enrollment
\`\`\`

## Troubleshooting 802.1X

\`\`\`bash
# FreeRADIUS debug mode (shows all authentication attempts)
sudo systemctl stop freeradius
sudo freeradius -X 2>&1 | tee /tmp/radius-debug.log

# Test a specific user
radtest john.smith Password123 127.0.0.1 0 SharedSecret

# Cisco switch: check 802.1X status on port
show dot1x interface GigabitEthernet1/0/1
show authentication sessions interface GigabitEthernet1/0/1

# Common failure reasons:
# 1. Wrong shared secret (client vs server mismatch)
# 2. Certificate not trusted (client doesn't trust RADIUS server cert)
# 3. User not in correct AD group
# 4. Machine account not in correct OU (for machine auth)
\`\`\`

802.1X deployment is a significant security improvement but requires coordination between network, identity, and endpoint teams. Start with monitoring mode (don't block, just log), verify everything works, then switch to enforcement mode.
`,
    contentFa: `## مقدمه

802.1X استاندارد IEEE برای کنترل دسترسی شبکه مبتنی بر پورت است. با نیاز به احراز هویت قبل از اعطای دسترسی شبکه، از اتصال دستگاه‌های غیرمجاز جلوگیری می‌کند.

## نحوه کارکرد

\`\`\`
دستگاه (Supplicant) → سوئیچ/AP (Authenticator) → سرور RADIUS
\`\`\`

## راه‌اندازی FreeRADIUS

\`\`\`bash
sudo apt install freeradius

# تنظیم clients (سوئیچ‌ها، AP ها)
# /etc/freeradius/3.0/clients.conf:
client cisco-switch-01 {
    ipaddr = 192.168.1.1
    secret = SharedSecretKey123!
}

# تست
radtest username password 127.0.0.1 0 testing123
\`\`\`

## پیکربندی سوئیچ سیسکو

\`\`\`
aaa new-model
aaa authentication dot1x default group radius

radius server NPS-01
  address ipv4 192.168.1.10 auth-port 1812
  key SharedSecretKey123!

interface GigabitEthernet1/0/1
  dot1x port-control auto
  authentication event fail action authorize vlan 99
\`\`\`

## تخصیص VLAN پویا

RADIUS می‌تواند VLAN ها را بر اساس هویت کاربر/دستگاه به‌صورت پویا تخصیص دهد:

\`\`\`
if (LDAP-Group == "IT-Staff") {
    reply:Tunnel-Private-Group-Id = "20"   # IT VLAN
}
elsif (LDAP-Group == "Finance") {
    reply:Tunnel-Private-Group-Id = "30"   # Finance VLAN
}
\`\`\`

استقرار 802.1X بهبود امنیتی قابل توجهی است. با حالت پایش شروع کنید (بدون مسدودسازی، فقط لاگ)، سپس به حالت اجرایی تغییر دهید.
`,
  },
  'wifi6-enterprise-design': {
    contentEn: `## Introduction

Wi-Fi 6 (802.11ax) is a significant upgrade from previous Wi-Fi generations, particularly important for high-density enterprise environments: open-plan offices, conference centers, and warehouses. Understanding Wi-Fi 6's new features — OFDMA, MU-MIMO, BSS Coloring, Target Wake Time — helps you design deployments that actually perform rather than just "work." This guide covers enterprise Wi-Fi 6 design and deployment.

## Wi-Fi 6 Key Technologies

**OFDMA (Orthogonal Frequency Division Multiple Access)**:
\`\`\`
Wi-Fi 5: One client uses the entire channel at a time
         AP → Client1 (uses 80MHz) → AP → Client2 (uses 80MHz)
         Clients take turns (inefficient)

Wi-Fi 6: Multiple clients share the channel simultaneously
         AP → Client1(20MHz) + Client2(20MHz) + Client3(40MHz) simultaneously
         Resource Units (RUs) divide the channel
         Dramatically reduces latency for many-client scenarios
\`\`\`

**MU-MIMO (Multi-User, Multiple Input Multiple Output)**:
\`\`\`
Wi-Fi 5: 4 spatial streams for downlink MU-MIMO
Wi-Fi 6: 8 spatial streams for both uplink AND downlink MU-MIMO
Allows simultaneous transmission to/from multiple clients
\`\`\`

**BSS Coloring**:
\`\`\`
Problem: Nearby APs on same channel cause interference
Wi-Fi 5: All see the channel as busy (inefficient)
Wi-Fi 6: Each BSS (AP) gets a "color" (1-63)
         Devices ignore transmissions from different-colored BSSs
         Reduces the hidden-node problem, allows denser deployments
\`\`\`

**Target Wake Time (TWT)**:
\`\`\`
Critical for IoT and battery-powered devices
AP schedules when each device wakes to receive data
Devices can sleep longer → dramatically better battery life
Used for: IoT sensors, barcode scanners, warehouse devices
\`\`\`

## Site Survey and Capacity Planning

\`\`\`
Before deploying, you need:

1. Floor plans and building materials
   - Concrete walls: -15dB attenuation
   - Drywall: -3dB attenuation
   - Glass: -2dB attenuation
   - Metal (filing cabinets, HVAC): heavy interference

2. Client density estimate
   - Open office: 1 device per 10-15 sq ft (phone + laptop)
   - Conference room: 3-5 devices per person
   - Warehouse: 1-2 devices per employee shift + IoT devices

3. Channel width selection
   - 2.4GHz: Only 3 non-overlapping channels (1, 6, 11)
              Use 20MHz channels only
   - 5GHz: Many non-overlapping channels
           Use 40MHz or 80MHz in most enterprise deployments
   - 6GHz (Wi-Fi 6E): Fresh spectrum, use 80MHz or 160MHz channels

4. AP density
   High-density: 1 AP per 1500 sq ft (300-500 clients per AP max)
   Standard office: 1 AP per 2500-3000 sq ft
\`\`\`

## AP Placement Guidelines

\`\`\`
Rule 1: Cell size over signal strength
    Don't try to cover the whole building from 2 APs
    Use more APs with lower transmit power (smaller cells)
    Target: -67 dBm RSSI minimum, -50 to -65 dBm ideal

Rule 2: Channel reuse
    5GHz channel plan (use all available channels):
    [CH36][CH40][CH44][CH48] - adjacent APs on different channels
    [CH149][CH153][CH157][CH161]

Rule 3: Eliminate co-channel interference
    APs on same channel should not overlap coverage
    Use Cisco DNA or similar to auto-tune channel/power
    Target: Received signal from neighboring same-channel AP < -80 dBm

Rule 4: AP orientation
    Ceiling mount: omni antenna provides 360° horizontal coverage
    Wall mount: directional, aim toward users not walls
\`\`\`

## Cisco Wireless Configuration (WLC)

\`\`\`
# Create SSID with WPA3 (Wi-Fi 6 best practice)
# Cisco DNA Center or WLC GUI:
WLAN Configuration:
  SSID: Corp-WiFi
  Security: WPA3-Enterprise
  Authentication: 802.1X (EAP-TLS or PEAP)
  RADIUS Server: 192.168.1.10:1812
  PMF (Protected Management Frames): Required (802.11w)
  Band: 5GHz and 6GHz (if 6E APs)
  Width: 80MHz

# QoS for voice/video
  Platinum QoS: VoIP calls (Cisco Jabber)
  Gold QoS: Video conferencing (Teams, Zoom)
  Silver QoS: General traffic

# Client isolation
  P2P Blocking: Enabled (clients can't talk directly)
\`\`\`

## VLAN and Roaming Design

\`\`\`
Multiple SSIDs → Multiple VLANs:
  Corp-WiFi   → VLAN 20 (employees with certificates)
  Guest-WiFi  → VLAN 99 (internet only, isolated)
  IoT-WiFi    → VLAN 50 (IoT devices, isolated from Corp)
  Voice-WiFi  → VLAN 30 (phones, Platinum QoS)

Seamless Roaming (fast roaming between APs):
  Enable 802.11r (Fast BSS Transition) for sub-50ms roaming
  Enable 802.11k (Neighbor Reports): AP tells client about neighbors
  Enable 802.11v (BSS Transition Management): AP can push client to better AP

# Important: 802.11r requires all APs in same mobility domain
# Configure matching MD ID on all WLCs/APs
\`\`\`

## Troubleshooting Wi-Fi 6 Performance

\`\`\`bash
# From client device:
# macOS
airport -I                        # Current connection info
airport -s                        # Scan for networks

# Linux
iwconfig wlan0                    # Basic info
iw dev wlan0 link                 # Detailed connection info
iw dev wlan0 station dump         # Station statistics

# Windows
netsh wlan show networks          # Available networks
netsh wlan show interfaces        # Current connection

# Common performance issues:
# 1. Sticky client (client stays on far AP)
#    Fix: Enable 802.11r, 11k, 11v; lower minimum RSSI threshold
#         set rssi-check -80 (kick clients below -80 dBm)

# 2. 2.4GHz congestion
#    Fix: Disable 2.4GHz for new SSID (5GHz and 6GHz only)
#         Or: Band steering to push capable clients to 5GHz

# 3. Hidden node (clients can't hear each other but AP can hear both)
#    Fix: Use RTS/CTS (adds overhead but prevents collisions)
#         Better: BSS Coloring (Wi-Fi 6 automatic)
\`\`\`

## Wi-Fi 6E: 6GHz Band

\`\`\`
Wi-Fi 6E adds the 6GHz band (5925-7125 MHz in US):
  1200 MHz of new spectrum
  7 additional 160MHz channels
  No legacy devices (6GHz is Wi-Fi 6 only)
  Clean spectrum (no legacy interference)

Use 6GHz for:
  - High-bandwidth applications (video production, CAD files)
  - Dense conference rooms
  - Latest laptops and phones (iPhone 15 Pro, recent Samsung)

Keep 5GHz for:
  - Legacy devices (still the majority)
  - Standard office workloads
\`\`\`

Enterprise Wi-Fi 6 design is fundamentally about cell planning and interference management, not just AP count. More APs at lower power with proper channel planning will outperform fewer high-power APs every time in dense environments.
`,
    contentFa: `## مقدمه

Wi-Fi 6 (802.11ax) ارتقاء قابل توجهی از نسل‌های قبلی Wi-Fi است، به‌ویژه برای محیط‌های سازمانی پرتراکم. درک فناوری‌های جدید Wi-Fi 6 به شما کمک می‌کند استقرارهایی طراحی کنید که واقعاً عملکرد خوبی داشته باشند.

## فناوری‌های کلیدی Wi-Fi 6

- **OFDMA**: چندین client به‌طور همزمان کانال را با Resource Unit های مختلف به اشتراک می‌گذارند
- **MU-MIMO 8x8**: ۸ جریان فضایی برای downlink و uplink همزمان
- **BSS Coloring**: AP های مجاور "رنگ" می‌گیرند تا تداخل کاهش یابد
- **Target Wake Time**: برای IoT و دستگاه‌های باتری‌دار، عمر باتری را بهبود می‌دهد

## برنامه‌ریزی ظرفیت

\`\`\`
- دفتر باز: ۱ AP به ازای هر ۱۵۰ متر مربع (۳۰۰-۵۰۰ client)
- هدف RSSI: حداقل -۶۷ dBm
- برنامه کانال ۵GHz: استفاده از تمام کانال‌های موجود بدون همپوشانی
\`\`\`

## طراحی SSID و VLAN

\`\`\`
Corp-WiFi  → VLAN 20 (کارمندان با گواهینامه)
Guest-WiFi → VLAN 99 (فقط اینترنت، ایزوله)
IoT-WiFi   → VLAN 50 (دستگاه‌های IoT، ایزوله)
\`\`\`

## Roaming سریع

\`\`\`
802.11r (Fast BSS Transition): Roaming زیر ۵۰ms
802.11k: AP اطلاعات همسایگان را به client می‌دهد
802.11v: AP می‌تواند client را به AP بهتر هدایت کند
\`\`\`

طراحی Wi-Fi 6 سازمانی اساساً در مورد برنامه‌ریزی سلول و مدیریت تداخل است. AP های بیشتر با توان کمتر و برنامه‌ریزی مناسب کانال، بهتر از AP های کمتر با توان بالا در محیط‌های پرتراکم عمل می‌کند.
`,
  },
  'mpls-l3vpn-service-provider': {
    contentEn: `## Introduction

MPLS L3VPN is the technology that service providers use to offer enterprise WAN connectivity (replacing expensive leased lines). Understanding how MPLS works is essential for any network engineer working with carrier networks or multi-site enterprise connectivity. This guide teaches the fundamentals and configuration of MPLS L3VPN.

## MPLS Concepts

MPLS adds labels to packets, enabling fast switching without per-packet routing table lookups:

\`\`\`
Normal IP routing:           MPLS forwarding:
Router receives IP packet → Router receives labeled packet →
Look up destination IP in   Pop label, push new label,
routing table (slow)        forward based on label (fast)

MPLS label structure (32-bit):
+---------------+------+---+-------+
|     Label     |  TC  | S |  TTL  |
| (20 bits)     |(3bit)|   |(8bit) |
+---------------+------+---+-------+
\`\`\`

## L3VPN Architecture

\`\`\`
Customer Site A ──── CE-A ──── PE-A ═══ (MPLS Core) ═══ PE-B ──── CE-B ──── Customer Site B
                              Provider Edge             Provider Edge
                              Router                    Router

CE = Customer Edge router (customer's equipment)
PE = Provider Edge router (ISP's router that connects to customer)
P  = Provider core router (ISP internal, never sees customer traffic)

PE routers maintain separate VRF (Virtual Routing and Forwarding) tables per customer:
- Customer A VRF: knows A's routes only
- Customer B VRF: knows B's routes only
Traffic never leaks between customers
\`\`\`

## Configuring MPLS L3VPN on Cisco IOS

\`\`\`
! === Provider Core: Enable MPLS ===
! On ALL routers in MPLS core:

ip cef              ! Required for MPLS
mpls label protocol ldp
mpls ldp router-id Loopback0 force

interface GigabitEthernet0/0
  mpls ip           ! Enable MPLS on core-facing interface

! Verify LDP neighbors
show mpls ldp neighbor

! Verify labels assigned to routes
show mpls forwarding-table
\`\`\`

\`\`\`
! === PE Router: Configure VRF for Customer ===
ip vrf CUSTOMER_A
  rd 65000:100           ! Route Distinguisher: makes routes globally unique
  route-target export 65000:100   ! Which routes to export to BGP
  route-target import 65000:100   ! Which routes to import from BGP

! Assign VRF to customer-facing interface
interface GigabitEthernet0/1
  ip vrf forwarding CUSTOMER_A
  ip address 10.0.0.1 255.255.255.252

! Configure MP-BGP between PE routers
router bgp 65000
  bgp log-neighbor-changes
  neighbor 10.255.0.2 remote-as 65000    ! iBGP with other PE
  neighbor 10.255.0.2 update-source Loopback0
  !
  address-family vpnv4
    neighbor 10.255.0.2 activate
    neighbor 10.255.0.2 send-community extended
  !
  address-family ipv4 vrf CUSTOMER_A
    neighbor 10.0.0.2 remote-as 65001    ! eBGP with customer CE
    neighbor 10.0.0.2 activate
    redistribute connected

! Verify VRF routing table
show ip route vrf CUSTOMER_A

! Verify VPNv4 routes in BGP
show bgp vpnv4 unicast all
\`\`\`

## Verification Commands

\`\`\`bash
! Check MPLS label switch paths
show mpls ldp bindings
show mpls forwarding-table [prefix]

! Trace MPLS path (shows labels at each hop)
traceroute mpls ipv4 10.100.1.0/24 source 10.255.0.1

! Check VPN routes
show ip route vrf CUSTOMER_A
show bgp vpnv4 unicast rd 65000:100

! Verify label stack on packets
debug mpls packets

! Check connectivity from PE perspective
ping vrf CUSTOMER_A 192.168.1.1
\`\`\`

## QoS in MPLS L3VPN

\`\`\`
! Mark traffic at CE and preserve markings
! On CE router:
ip access-list extended VOICE-TRAFFIC
  permit udp any any range 16384 32767  ! RTP voice

class-map match-any VOICE
  match access-group name VOICE-TRAFFIC

policy-map MARK-VOICE
  class VOICE
    set ip dscp ef          ! Mark as Expedited Forwarding
  class class-default
    set ip dscp default

interface GigabitEthernet0/0
  service-policy output MARK-VOICE

! On PE: map DSCP to MPLS EXP bits for QoS through core
! The MPLS EXP (experimental) bits carry QoS markings through core
\`\`\`

## Troubleshooting MPLS L3VPN

\`\`\`
! Customer can't reach other site - troubleshooting steps:

1. Check PE can reach customer CE:
ping vrf CUSTOMER_A 10.0.0.2

2. Check customer routes in PE VRF:
show ip route vrf CUSTOMER_A

3. Check routes being exported to VPNv4 BGP:
show bgp vpnv4 unicast all

4. Check MPLS forwarding works:
traceroute mpls ipv4 10.255.0.2/32 source 10.255.0.1

5. Check label stack:
show mpls forwarding-table 10.255.0.2 detail
\`\`\`

MPLS L3VPN is the backbone of enterprise WAN connectivity worldwide. The key concepts to master: VRF isolation (keeps customer traffic separate), Route Distinguishers (make routes globally unique), Route Targets (control which VRFs share routes), and MP-BGP (transports VPN routes between PE routers).
`,
    contentFa: `## مقدمه

MPLS L3VPN فناوری است که ارائه‌دهندگان سرویس برای ارائه اتصال WAN سازمانی استفاده می‌کنند. درک نحوه کارکرد MPLS برای هر مهندس شبکه‌ای که با شبکه‌های carrier یا اتصال چند-سایته کار می‌کند ضروری است.

## معماری L3VPN

\`\`\`
CE-A ── PE-A ═══ (هسته MPLS) ═══ PE-B ── CE-B

CE = Customer Edge (تجهیزات مشتری)
PE = Provider Edge (روتر ISP که به مشتری متصل است)
روترهای PE جداول VRF جداگانه‌ای برای هر مشتری نگه می‌دارند
\`\`\`

## پیکربندی MPLS L3VPN در سیسکو

\`\`\`
! فعال‌سازی MPLS در هسته
ip cef
mpls label protocol ldp

interface GigabitEthernet0/0
  mpls ip

! پیکربندی VRF برای مشتری
ip vrf CUSTOMER_A
  rd 65000:100
  route-target export 65000:100
  route-target import 65000:100

! تخصیص VRF به اینترفیس روبروی مشتری
interface GigabitEthernet0/1
  ip vrf forwarding CUSTOMER_A
  ip address 10.0.0.1 255.255.255.252
\`\`\`

## تأیید و عیب‌یابی

\`\`\`
show ip route vrf CUSTOMER_A
show bgp vpnv4 unicast all
show mpls forwarding-table
traceroute mpls ipv4 10.255.0.2/32 source 10.255.0.1
\`\`\`

مفاهیم کلیدی: ایزوله‌سازی VRF، Route Distinguisher ها، Route Target ها و MP-BGP.
`,
  },
  'nat-pat-deep-dive': {
    contentEn: `## Introduction

NAT (Network Address Translation) and PAT (Port Address Translation) are technologies that allow private IP addresses to communicate on the internet. While every junior network engineer knows what NAT does conceptually, truly mastering it means understanding the different types, their behaviors with specific applications, troubleshooting translation table issues, and configuring NAT in complex enterprise scenarios. This guide dives deep.

## NAT Types Explained

**Static NAT**: One-to-one permanent mapping:
\`\`\`
Private: 192.168.1.50 ←→ Public: 203.0.113.50 (always)
Use case: DMZ servers that must be consistently reachable from internet
\`\`\`

**Dynamic NAT**: Pool of public IPs assigned on demand:
\`\`\`
Private 192.168.1.0/24 → Pool: 203.0.113.100-203.0.113.110 (first-fit)
Use case: When you have multiple public IPs but fewer than clients
\`\`\`

**PAT (Overload/Many-to-One NAT)**: Multiple private IPs → single public IP:
\`\`\`
192.168.1.10:54321 → 203.0.113.1:10001 (tracked by port)
192.168.1.11:54322 → 203.0.113.1:10002
192.168.1.12:65001 → 203.0.113.1:10003
Use case: 99% of home/office internet connections
\`\`\`

## Cisco IOS NAT Configuration

\`\`\`
! PAT (most common): Many inside → One outside address
interface GigabitEthernet0/0
  ip address 192.168.1.1 255.255.255.0
  ip nat inside

interface GigabitEthernet0/1
  ip address 203.0.113.1 255.255.255.252
  ip nat outside

! Define what to translate
ip access-list standard INSIDE-HOSTS
  permit 192.168.1.0 0.0.0.255

! Enable PAT using outside interface IP
ip nat inside source list INSIDE-HOSTS interface GigabitEthernet0/1 overload

! Verify
show ip nat translations
show ip nat statistics
\`\`\`

\`\`\`
! Static NAT: DMZ web server
ip nat inside source static 192.168.100.10 203.0.113.50

! Static NAT with port (Port Forwarding):
! External port 8443 → internal server port 443
ip nat inside source static tcp 192.168.100.20 443 203.0.113.1 8443

! Dynamic NAT pool
ip nat pool PUBLIC-POOL 203.0.113.100 203.0.113.110 netmask 255.255.255.240
ip nat inside source list INSIDE-HOSTS pool PUBLIC-POOL
\`\`\`

## Linux NAT with iptables

\`\`\`bash
# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf

# PAT: masquerade all traffic from 192.168.1.0/24 through eth0
iptables -t nat -A POSTROUTING -s 192.168.1.0/24 -o eth0 -j MASQUERADE

# Static DNAT (port forwarding):
# External :80 → 192.168.1.50:80
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80   -j DNAT --to-destination 192.168.1.50:80

# Allow forwarding
iptables -A FORWARD -d 192.168.1.50 -p tcp --dport 80 -j ACCEPT

# Save rules
iptables-save > /etc/iptables/rules.v4

# With nftables (modern alternative):
nft add rule ip nat POSTROUTING oifname "eth0" masquerade
nft add rule ip nat PREROUTING iifname "eth0" tcp dport 80 dnat to 192.168.1.50
\`\`\`

## Double NAT (Nested NAT)

\`\`\`
Problem scenario:
Internet → ISP Router (NAT: 100.64.x.x → public) →
  Customer Router (NAT: 192.168.1.x → 100.64.x.x) →
  Device

This is "Double NAT" (common with CG-NAT ISPs).
Issues it causes:
- Port forwarding doesn't work (two layers to configure)
- Some applications break (gaming, VoIP, video calls)
- Troubleshooting becomes complex

Solutions:
1. Ask ISP for public IP (bypass CG-NAT)
2. Use VPN to ISP to get routable address
3. Use UPNP on outer router (often not available)
4. For servers: use IPv6 (no NAT needed)
\`\`\`

## NAT and Application Layer Gateways (ALG)

Some protocols embed IP addresses in their payload (FTP, SIP, H.323), breaking NAT:

\`\`\`
FTP problem: FTP client sends its private IP in PORT command:
"PORT 192.168.1.50,x,y" → Server tries to connect to 192.168.1.50 (unreachable!)

Solution: FTP ALG (Application Layer Gateway) rewrites the payload:
"PORT 192.168.1.50,x,y" → "PORT 203.0.113.1,x,y"

# Cisco IOS: ALG is often enabled by default
# Check:
show ip nat translations protocol tcp

# Disable ALG if causing issues with SIP over NAT
no ip nat service sip udp port 5060
\`\`\`

## Troubleshooting NAT

\`\`\`
! Cisco IOS troubleshooting
! See current translation table
show ip nat translations
show ip nat translations verbose

! Statistics (track hits, misses, expired)
show ip nat statistics

! Debug NAT translations (be careful in production!)
debug ip nat
debug ip nat [access-list SPECIFIC-HOST]

! Common issues:
! 1. "No translation" - ACL or route miss
!    Check: show ip route 203.0.113.x (is return traffic routed back?)
! 2. Asymmetric routing (traffic goes in one router, returns via different)
!    Fix: ensure both directions pass through same NAT device
! 3. NAT table full (too many concurrent sessions)
!    Check: show ip nat statistics | include max
!    Fix: ip nat translation max-entries 100000
\`\`\`

\`\`\`bash
# Linux NAT troubleshooting
# View current NAT table
conntrack -L

# Watch real-time translations
conntrack -E

# Count entries
conntrack -C

# Clear stale connections
conntrack -D --state TIME_WAIT
\`\`\`

## NAT64 (IPv6 to IPv4 Translation)

\`\`\`
As IPv6 adoption grows, some clients are IPv6-only and need to reach IPv4 servers.
NAT64 translates between them:

IPv6 client: 2001:db8::1
NAT64 prefix: 64:ff9b::/96
IPv4 server: 203.0.113.50

IPv6 client sends to: 64:ff9b::203.0.113.50 (embedded IPv4)
NAT64 router translates to: 203.0.113.50
Return traffic translated back

# Configure NAT64 on Cisco
ipv6 nat v6v4 source 2001:db8::/32 203.0.113.0
ipv6 nat prefix 64:ff9b::/96 v4-mapped
\`\`\`

NAT mastery requires understanding not just configuration syntax but the behavioral implications: how it interacts with stateful firewalls, the importance of connection tracking tables, and why certain applications require ALGs or NAT traversal techniques.
`,
    contentFa: `## مقدمه

NAT و PAT فناوری‌هایی هستند که به آدرس‌های IP خصوصی اجازه می‌دهند در اینترنت ارتباط برقرار کنند. تسلط واقعی بر NAT یعنی درک انواع مختلف، رفتارشان با اپلیکیشن‌های خاص و عیب‌یابی مشکلات جدول ترجمه.

## انواع NAT

- **Static NAT**: نگاشت یک‌به‌یک دائمی (برای سرورهای DMZ)
- **Dynamic NAT**: pool از IP های عمومی اختصاص‌یافته بر حسب تقاضا
- **PAT (Overload)**: چندین IP خصوصی → یک IP عمومی (با پورت متمایز)

## پیکربندی PAT در سیسکو

\`\`\`
interface GigabitEthernet0/0
  ip nat inside

interface GigabitEthernet0/1
  ip nat outside

ip access-list standard INSIDE-HOSTS
  permit 192.168.1.0 0.0.0.255

ip nat inside source list INSIDE-HOSTS interface GigabitEthernet0/1 overload

! پورت فوروارد (Port Forwarding)
ip nat inside source static tcp 192.168.100.20 443 203.0.113.1 8443
\`\`\`

## عیب‌یابی

\`\`\`
show ip nat translations verbose
show ip nat statistics

! Linux
conntrack -L
conntrack -E  # real-time
\`\`\`

تسلط بر NAT نیازمند درک نه تنها سینتکس پیکربندی بلکه پیامدهای رفتاری آن است: نحوه تعامل با فایروال‌های stateful و اهمیت جداول connection tracking.
`,
  },
  'network-access-control-design': {
    contentEn: `## Introduction

Network Access Control (NAC) is the policy enforcement layer that decides which devices can join your network and with what access level. A modern enterprise network can't just use 802.1X authentication alone — it needs to also verify device health (Is it patched? Does it have antivirus? Is it managed?). This guide covers designing and deploying a comprehensive NAC solution.

## NAC Architecture

\`\`\`
Device attempts to connect
         ↓
Authentication (802.1X / MAC)
         ↓
Posture Assessment (device health check)
    ├── Pass: Full network access (Corporate VLAN)
    ├── Partial: Limited access (Quarantine VLAN for remediation)
    └── Fail: Guest VLAN only (internet access only)
         ↓
Continuous monitoring (check periodically, revoke if compromised)
\`\`\`

## Cisco ISE (Identity Services Engine)

Cisco ISE is the most common enterprise NAC solution:

\`\`\`
ISE Components:
- Policy Administration Node (PAN): Configuration and UI
- Policy Service Node (PSN): Authentication and authorization
- Monitoring and Troubleshooting Node (MnT): Logging and reports

Integration points:
- Active Directory: User identity and group membership
- RADIUS: 802.1X authentication with switches/APs
- MDMMDM (Intune/Jamf): Device management status
- Vulnerability scanners: Device patch status
\`\`\`

## Policy Design

\`\`\`
NAC Policy Matrix:

Device Type   | Auth Method  | Posture     | Assigned Network
--------------|--------------|-------------|------------------
Managed Corp  | 802.1X cert  | Compliant   | Corporate VLAN 10
Managed Corp  | 802.1X cert  | Non-compliant| Remediation VLAN 50
BYOD (employee)| 802.1X cred | Registered  | BYOD VLAN 30
BYOD (employee)| 802.1X cred | Unregistered| Guest portal
Contractor    | Guest portal | -           | Contractor VLAN 40
Unknown device| MAC auth     | -           | Guest VLAN 99
IoT device    | MAC auth     | -           | IoT VLAN 60
\`\`\`

## Posture Checks

\`\`\`
Minimum device requirements (example policy):
- Windows: OS version ≥ Windows 10 21H2
  Latest security patches (within 14 days)
  Windows Defender enabled and updated
  Disk encryption (BitLocker) enabled
  Corporate AV agent installed and running

- macOS: Version ≥ macOS 12 Monterey
  FileVault encryption enabled
  Gatekeeper enabled
  Corporate MDM profile installed

- Mobile (iOS/Android): MDM enrolled
  Screen lock enabled
  OS version within 1 major version of latest
\`\`\`

## ISE Policy Configuration (Example)

\`\`\`
Authorization Policy Rules (evaluated in order):

Rule 1: ISE-Compliant-Employee
  Conditions:
    Identity Group = AD:Domain Computers
    AND Compliance Status = Compliant
    AND AD Group = AD:Employees
  Result:
    VLAN = 10 (Corporate)
    dACL = Full-Access-Policy
    Reauthentication: Every 8 hours

Rule 2: Non-Compliant-Corporate
  Conditions:
    Identity Group = AD:Domain Computers
    AND Compliance Status = Non-Compliant
  Result:
    VLAN = 50 (Remediation)
    dACL = Remediation-Only
    Redirect URL = https://ise.company.com/remediation

Rule 3: BYOD-Employee
  Conditions:
    AD Group = AD:Employees
    AND Device Type = Personal Device
  Result:
    VLAN = 30 (BYOD)
    dACL = BYOD-Policy (internet + email only)

Rule 4: Default
  Conditions: ALL
  Result:
    VLAN = 99 (Guest)
    dACL = Guest-Policy
\`\`\`

## Guest Access Workflow

\`\`\`
Guest connects to "Guest-WiFi" SSID
    ↓
Redirect to captive portal (https://guest.company.com)
    ↓
Guest registers: Name, Email, Phone, Host Employee
    ↓
Sponsor (employee) receives email/SMS: "Approve guest access?"
    ↓
On approval: Guest gets limited network access
    - Internet only
    - Duration: 8 hours (or what sponsor set)
    - Can be revoked by sponsor or auto-expires

Guest VLAN policy:
  - Access internet on port 80/443
  - Access DNS (port 53)
  - No access to internal networks
  - Bandwidth limit: 5 Mbps per client
\`\`\`

## Deploying Posture Agent

\`\`\`
Cisco AnyConnect + Posture Module:
1. Deploy AnyConnect package via SCCM/Intune
2. ISE profile: download posture module automatically when user connects
3. User connects → ISE detects no posture module → redirects to ISE agent download
4. User installs agent → agent checks device compliance
5. Report sent to ISE → policy applied

Agentless posture (basic, for BYOD):
- ISE checks: OS type/version (from user-agent)
- MDM connector: Is device MDM enrolled?
- No deep checks possible without agent
\`\`\`

## Troubleshooting NAC

\`\`\`
# Cisco ISE: View authentication events
# ISE → Operations → RADIUS → Live Logs

# Failed authentications show:
# - Auth failure reason (wrong cert, wrong credentials)
# - Policy matched
# - Authorization result

# Switch: Debug 802.1X
debug dot1x all
show dot1x interface Gi1/0/1

# Check what VLAN was assigned
show authentication sessions interface Gi1/0/1

# ISE posture issues:
# ISE → Operations → Posture → Live Sessions
# Shows posture status, compliance details

# Common issues:
# 1. Certificate not trusted: Install ISE cert in trusted root CA store
# 2. Posture timeout: Increase timeout or check AV scan speed
# 3. MAC auth fallback: Configure when 802.1X times out
# 4. VoIP phones: Use voice VLAN (CDP/LLDP auto-detection)
\`\`\`

NAC is complex but the security benefit is enormous: you know exactly what devices are on your network, in what state, and can automatically quarantine non-compliant devices. Start with monitoring mode (log but don't enforce), validate your policy logic, then enable enforcement gradually VLAN by VLAN.
`,
    contentFa: `## مقدمه

Network Access Control (NAC) لایه اجرای سیاست است که تصمیم می‌گیرد کدام دستگاه‌ها می‌توانند به شبکه شما بپیوندند و با چه سطح دسترسی. یک شبکه سازمانی مدرن نمی‌تواند فقط از احراز هویت 802.1X استفاده کند - باید سلامت دستگاه را نیز تأیید کند.

## معماری NAC

\`\`\`
دستگاه تلاش به اتصال می‌کند
         ↓
احراز هویت (802.1X / MAC)
         ↓
ارزیابی وضعیت (بررسی سلامت دستگاه)
    ├── موفق: دسترسی کامل (Corporate VLAN)
    ├── جزئی: دسترسی محدود (Quarantine VLAN)
    └── شکست: فقط VLAN مهمان
\`\`\`

## ماتریس سیاست NAC

\`\`\`
دستگاه مدیریت‌شده + سازگار  → VLAN ۱۰ (Corporate)
دستگاه مدیریت‌شده + ناسازگار → VLAN ۵۰ (Remediation)
BYOD کارمند                  → VLAN ۳۰ (BYOD)
مهمان                        → VLAN ۹۹ (Guest)
IoT                          → VLAN ۶۰ (IoT)
\`\`\`

## حداقل الزامات دستگاه

\`\`\`
Windows:
- نسخه OS ≥ Windows 10 21H2
- آخرین patch های امنیتی (در ۱۴ روز)
- Windows Defender فعال و به‌روز
- رمزگذاری دیسک (BitLocker) فعال
\`\`\`

## عیب‌یابی

\`\`\`
# سوئیچ سیسکو
show authentication sessions interface Gi1/0/1
debug dot1x all

# رویدادهای احراز هویت ISE
# ISE → Operations → RADIUS → Live Logs
\`\`\`

NAC پیچیده است اما مزیت امنیتی آن بسیار زیاد است. با حالت پایش شروع کنید، منطق سیاست را تأیید کنید، سپس اجرا را به‌تدریج VLAN به VLAN فعال کنید.
`,
  },
  'dns-security-dnssec': {
    contentEn: `## Introduction

DNS is one of the most critical yet often overlooked attack surfaces in infrastructure. DNS cache poisoning, DNS hijacking, and DNS-based data exfiltration are real threats in production environments. DNSSEC (DNS Security Extensions) adds cryptographic signatures to DNS records, preventing spoofing. This guide covers both DNS security threats and defenses, including DNSSEC deployment.

## DNS Attack Types

**Cache Poisoning (Kaminsky Attack)**:
\`\`\`
1. Attacker floods resolver with forged responses for bank.com
2. Attacker guesses the Query ID (16-bit number)
3. If attacker's response arrives before real response:
   Resolver caches attacker's fake IP for bank.com
4. All clients using this resolver now go to attacker's server

Mitigations:
- Source port randomization (RFC 5452) — increases attack space
- DNSSEC validation
- DNS-over-HTTPS or DNS-over-TLS
\`\`\`

**DNS Hijacking**:
\`\`\`
Attacker compromises the authoritative nameserver or registry account
→ Changes A record for victim.com to attacker's IP
→ All traffic goes to attacker
\`\`\`

**DNS Exfiltration**:
\`\`\`
Malware on compromised host encodes stolen data in DNS queries:
dns-query: data-chunk1.attacker-controlled-domain.com
dns-query: data-chunk2.attacker-controlled-domain.com
...
(firewall allows DNS, doesn't inspect content)

Detection: unusually long subdomain names, high query rates
\`\`\`

## DNSSEC: How It Works

\`\`\`
Without DNSSEC:
Client → DNS Resolver → "A record: 203.0.113.50" (could be spoofed)

With DNSSEC:
Zone owner signs records with private key
Client validates signature with zone's public key

DNS response with DNSSEC:
A record: 203.0.113.50
RRSIG: [cryptographic signature over the A record]
Client verifies: signature is valid → trust the A record
\`\`\`

## Signing a Zone with DNSSEC

\`\`\`bash
# BIND: Sign a zone
cd /var/named/

# Generate Zone Signing Key (ZSK) - rotates frequently
dnssec-keygen -a RSASHA256 -b 2048 -n ZONE company.com
# Creates: Kcompany.com.+008+12345.key and .private

# Generate Key Signing Key (KSK) - long-lived
dnssec-keygen -a RSASHA256 -b 4096 -n ZONE -f KSK company.com
# Creates: Kcompany.com.+008+67890.key and .private

# Add keys to zone file
cat Kcompany.com.*.key >> /var/named/company.com.zone

# Sign the zone
dnssec-signzone -A -3 $(head -c 1000 /dev/urandom | sha1sum | cut -b 1-16)   -N increment -o company.com -t company.com.zone

# This creates: company.com.zone.signed

# Update BIND to use signed zone
# /etc/named.conf:
zone "company.com" {
    type master;
    file "company.com.zone.signed";
    auto-dnssec maintain;
    inline-signing yes;
};
\`\`\`

## Deploying DNSSEC with PowerDNS (Modern Approach)

\`\`\`bash
# PowerDNS with SQLite backend
apt install pdns-server pdns-backend-sqlite3

# Enable DNSSEC
pdnsutil secure-zone company.com

# Check signing status
pdnsutil check-zone company.com

# Get DS record to provide to registrar
pdnsutil show-zone company.com | grep DS

# Rectify zone after changes
pdnsutil rectify-zone company.com
\`\`\`

## Configuring DNSSEC Validation on Resolvers

\`\`\`bash
# BIND resolver: enable DNSSEC validation
# /etc/named.conf
options {
    dnssec-enable yes;
    dnssec-validation auto;  # Uses built-in trust anchors
    dnssec-lookaside auto;
};

# Test DNSSEC validation
dig +dnssec A sigfail.verteiltesysteme.net
# If you see "ad" flag in response: authentication done
# SERVFAIL response means signature validation failed

# Cloudflare DNS (1.1.1.1) validates DNSSEC by default
dig @1.1.1.1 +dnssec +short A company.com
\`\`\`

## DNS Filtering and RPZ (Response Policy Zones)

\`\`\`bash
# Block malicious domains using RPZ
# /etc/named.conf
response-policy {
    zone "rpz.company.local";  # Your blacklist zone
    zone "rpz.surbl.org";      # External threat intelligence
};

# /var/named/rpz.company.local.zone
$TTL 60
@     SOA rpz.company.local. admin.company.local. 2024010101 3600 900 86400 60

; Block known malware domains
malware-site.com.rpz.company.local CNAME .    ; Return NXDOMAIN
phishing-bank.net.rpz.company.local CNAME .
\`\`\`

## DNS-over-HTTPS and DNS-over-TLS

\`\`\`bash
# Set up unbound as DoT resolver
apt install unbound

# /etc/unbound/unbound.conf
server:
  interface: 127.0.0.1
  port: 53
  verbosity: 1

  # Validate DNSSEC
  val-clean-additional: yes
  dnssec-mode: "auto"

  # Forward to CloudFlare DoT
  forward-zone:
    name: "."
    forward-tls-upstream: yes
    forward-addr: 1.1.1.1@853#cloudflare-dns.com
    forward-addr: 1.0.0.1@853#cloudflare-dns.com

# Test DoT
kdig @1.1.1.1 +tls company.com
\`\`\`

## Monitoring DNS for Threats

\`\`\`python
#!/usr/bin/env python3
# dns_monitor.py - Detect DNS exfiltration attempts
import subprocess
import re
from collections import defaultdict

def analyze_dns_log(logfile):
    query_counts = defaultdict(int)
    long_subdomains = []

    with open(logfile) as f:
        for line in f:
            # Parse BIND query log format
            match = re.search(r'query: (\S+) IN', line)
            if match:
                domain = match.group(1)
                parts = domain.split('.')

                # Flag unusually long subdomains (exfiltration indicator)
                if parts and len(parts[0]) > 40:
                    long_subdomains.append(domain)

                # Count queries per base domain
                if len(parts) >= 2:
                    base = '.'.join(parts[-2:])
                    query_counts[base] += 1

    # Report anomalies
    print("=== High-frequency domains ===")
    for domain, count in sorted(query_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {count:5d} queries: {domain}")

    if long_subdomains:
        print("
=== SUSPICIOUS: Long subdomains (possible exfiltration) ===")
        for domain in long_subdomains[:20]:
            print(f"  {domain}")

if __name__ == "__main__":
    analyze_dns_log("/var/log/named/query.log")
\`\`\`

DNS security is a layered problem: DNSSEC prevents spoofing, DNS filtering blocks known-bad domains, DoT/DoH encrypts queries in transit, and log monitoring detects abuse. Each layer addresses different threat vectors.
`,
    contentFa: `## مقدمه

DNS یکی از حیاتی‌ترین اما اغلب نادیده‌گرفته‌شده‌ترین سطوح حمله در زیرساخت است. مسموم‌سازی cache DNS، ربودن DNS و خروج داده مبتنی بر DNS تهدیدات واقعی هستند. DNSSEC امضاهای رمزنگاری به رکوردهای DNS اضافه می‌کند.

## حملات DNS

- **Cache Poisoning**: تزریق پاسخ‌های جعلی به resolver
- **DNS Hijacking**: سازش nameserver یا حساب registrar
- **DNS Exfiltration**: رمزگذاری داده‌های دزدیده‌شده در query های DNS

## DNSSEC: امضای Zone

\`\`\`bash
# تولید کلیدها
dnssec-keygen -a RSASHA256 -b 2048 -n ZONE company.com   # ZSK
dnssec-keygen -a RSASHA256 -b 4096 -n ZONE -f KSK company.com  # KSK

# امضای zone
dnssec-signzone -A -o company.com -t company.com.zone

# با PowerDNS (آسان‌تر)
pdnsutil secure-zone company.com
pdnsutil show-zone company.com | grep DS  # DS record برای registrar
\`\`\`

## اعتبارسنجی DNSSEC روی Resolver

\`\`\`bash
# در BIND
options {
    dnssec-validation auto;
};

# تست
dig +dnssec A company.com
# اگر پرچم "ad" در پاسخ باشد: احراز هویت انجام شد
\`\`\`

## فیلتر DNS با RPZ

\`\`\`bash
# /var/named/rpz.company.local.zone
malware-site.com.rpz.company.local CNAME .    # بازگشت NXDOMAIN
phishing.net.rpz.company.local CNAME .
\`\`\`

امنیت DNS یک مشکل لایه‌ای است: DNSSEC از جعل جلوگیری می‌کند، فیلتر DNS دامنه‌های مخرب شناخته‌شده را مسدود می‌کند و DoT/DoH query ها را در حین انتقال رمزگذاری می‌کند.
`,
  },
  'container-security-best-practices': {
    contentEn: `## Introduction

Container security is not automatic — a Docker container running as root with no resource limits and a publicly pulled image is a significant security risk. Enterprise container deployments require deliberate security hardening at every layer: image security, runtime security, network isolation, and secret management. This guide teaches practical container security for production environments.

## Image Security

The most common container security mistake: using unvetted base images.

\`\`\`dockerfile
# Bad: using latest (unpinned) base image
FROM ubuntu:latest  # Could change any day

# Bad: running as root (default)
COPY app /app
CMD ["/app"]

# Good: pinned version, non-root user
FROM ubuntu:22.04@sha256:2b7412e6465c3c7fc5bb21d3e6f1917c167358449fecac8176c6e496e5c1f05f

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set proper ownership
COPY --chown=appuser:appuser . /app
WORKDIR /app

# Drop ALL Linux capabilities, only add what's needed
USER appuser

# Don't run as PID 1 (use tini or dumb-init)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/server"]
\`\`\`

## Scanning Images for Vulnerabilities

\`\`\`bash
# Trivy: scan for CVEs, misconfigurations, secrets
trivy image company/myapp:v1.2.3

# Output example:
# Total: 15 (CRITICAL: 2, HIGH: 5, MEDIUM: 8)
# Library         Vulnerability   Severity  Installed   Fixed
# libssl1.1       CVE-2021-3711   CRITICAL  1.1.1k      1.1.1l

# Integrate into CI pipeline
trivy image --exit-code 1 --severity CRITICAL company/myapp:latest
# Fails pipeline if CRITICAL CVEs found

# Scan Dockerfile for misconfigurations
trivy config ./Dockerfile

# Snyk alternative
snyk container test company/myapp:latest

# Docker Scout (built into Docker Desktop)
docker scout cves company/myapp:latest
\`\`\`

## Runtime Security with Seccomp and AppArmor

\`\`\`bash
# Seccomp: restrict system calls available to container
# Create seccomp profile
cat > /etc/docker/seccomp/myapp.json << 'EOF'
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [
    {
      "names": [
        "accept4", "bind", "brk", "clock_gettime",
        "close", "connect", "epoll_create1", "epoll_ctl",
        "epoll_wait", "exit_group", "fcntl", "fstat",
        "futex", "getpid", "listen", "mmap", "mprotect",
        "munmap", "nanosleep", "poll", "read", "recvfrom",
        "sendto", "set_robust_list", "setsockopt", "sigaltstack",
        "socket", "stat", "write"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
EOF

# Run with seccomp profile
docker run --security-opt seccomp=/etc/docker/seccomp/myapp.json company/myapp:latest

# AppArmor profile (Ubuntu/Debian)
# /etc/apparmor.d/docker-myapp
profile docker-myapp flags=(attach_disconnected, mediate_deleted) {
  network tcp,
  network udp,
  deny network raw,
  file /app/** r,
  file /tmp/** rw,
  deny /etc/shadow r,
  deny @{PROC}/sysrq-trigger rwmlk,
}

apparmor_parser -r -W /etc/apparmor.d/docker-myapp
docker run --security-opt apparmor=docker-myapp company/myapp:latest
\`\`\`

## Kubernetes Pod Security

\`\`\`yaml
# Pod Security Context: enforce non-root, read-only filesystem
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault

  containers:
  - name: app
    image: company/myapp:v1.2.3
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true    # Immutable container filesystem
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]     # Only add what's needed

    resources:
      limits:
        cpu: "500m"
        memory: "512Mi"
      requests:
        cpu: "100m"
        memory: "128Mi"

    volumeMounts:
    - name: tmp-dir
      mountPath: /tmp              # Writable tmp

  volumes:
  - name: tmp-dir
    emptyDir: {}
\`\`\`

## Network Security in Containers

\`\`\`yaml
# NetworkPolicy: deny all, allow only needed
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress  # Only ingress controller can reach app
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres      # App can only talk to postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - namespaceSelector: {}  # Allow DNS queries
    ports:
    - protocol: UDP
      port: 53
\`\`\`

## Secrets Management

\`\`\`bash
# Never pass secrets as environment variables (visible in ps, docker inspect, logs)
docker run -e DATABASE_PASSWORD=secret123 myapp  # BAD

# Better: Docker secrets (Swarm)
echo "secret123" | docker secret create db_password -
docker service create --secret db_password myapp
# Secret available at: /run/secrets/db_password

# Best: Vault Agent sidecar (see hashicorp-vault-secrets guide)
# Or: Kubernetes Secrets with external-secrets operator
kubectl create secret generic db-creds   --from-literal=password=secret123   --namespace production
\`\`\`

## Falco: Runtime Threat Detection

\`\`\`yaml
# Falco detects suspicious container behavior
# /etc/falco/falco_rules.yaml
- rule: Shell in Container
  desc: Detect shell execution in a container
  condition: container and proc.name in (bash, sh, ash, zsh) and not proc.pname in (runc)
  output: "Shell spawned in container (user=%user.name container=%container.name cmd=%proc.cmdline)"
  priority: WARNING

- rule: Write below /etc
  desc: Detect file writes to /etc
  condition: container and fd.name startswith /etc and evt.type = write
  output: "Write to /etc in container (container=%container.name file=%fd.name)"
  priority: ERROR

- rule: Outbound Connection to Rare IP
  desc: Detect unexpected outbound connections
  condition: >
    outbound and container and
    not fd.sip in (allowed_outbound_destinations)
  output: "Unexpected outbound connection (container=%container.name ip=%fd.sip)"
  priority: WARNING
\`\`\`

Container security is defense-in-depth: start with non-root images and vulnerability scanning in CI, add resource limits and network policies in Kubernetes, and use runtime security tools to detect anomalies. No single control is sufficient — security comes from the combination.
`,
    contentFa: `## مقدمه

امنیت container خودکار نیست - یک container Docker که به عنوان root اجرا می‌شود با محدودیت منابع صفر یک خطر امنیتی قابل توجه است. این راهنما سخت‌کاری امنیتی عملی container را برای محیط‌های production آموزش می‌دهد.

## امنیت Image

\`\`\`dockerfile
# اشتباه: استفاده از latest و اجرا به عنوان root

# درست: نسخه pin شده، کاربر غیر root
FROM ubuntu:22.04@sha256:2b7412e...

RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --chown=appuser:appuser . /app
USER appuser
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/server"]
\`\`\`

## اسکن برای آسیب‌پذیری

\`\`\`bash
trivy image company/myapp:v1.2.3

# شکست pipeline برای CVE های CRITICAL
trivy image --exit-code 1 --severity CRITICAL company/myapp:latest
\`\`\`

## امنیت Pod در Kubernetes

\`\`\`yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true  # Filesystem غیرقابل تغییر
  capabilities:
    drop: ["ALL"]
    add: ["NET_BIND_SERVICE"]  # فقط آنچه لازم است اضافه کنید

resources:
  limits:
    cpu: "500m"
    memory: "512Mi"
\`\`\`

## NetworkPolicy

\`\`\`yaml
# انکار همه، اجازه فقط به آنچه لازم است
spec:
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
\`\`\`

امنیت container دفاع در عمق است: با image های غیر root و اسکن آسیب‌پذیری در CI شروع کنید، محدودیت‌های منابع و network policy در Kubernetes اضافه کنید، و از ابزارهای امنیت runtime برای تشخیص ناهنجاری‌ها استفاده کنید.
`,
  },
  'network-troubleshooting-methodology': {
    contentEn: `## Introduction

Systematic network troubleshooting is the skill that separates experienced engineers from junior ones. Without a methodology, troubleshooting becomes random and time-consuming — checking things in no particular order, missing the actual cause. This guide teaches you the OSI model-based troubleshooting framework and specific techniques for common real-world network problems.

## The OSI Troubleshooting Framework

Always start at Layer 1 and work up. Don't jump to Layer 7 if Layer 1 hasn't been verified:

\`\`\`
Layer 7 - Application: Can the application communicate?
Layer 6 - Presentation: Encoding/encryption issues?
Layer 5 - Session: Are sessions being established?
Layer 4 - Transport: Are TCP/UDP connections working?
Layer 3 - Network: Is IP routing correct?
Layer 2 - Data Link: Are MAC addresses resolving?
Layer 1 - Physical: Is the cable/link actually working?
\`\`\`

## Layer 1: Physical

\`\`\`bash
# Linux: check link status
ip link show eth0
# Look for: UP (good) vs DOWN (bad)
# ethtool shows more detail:
ethtool eth0 | grep -E "Speed|Duplex|Link"
# Speed: 1000Mb/s (should match switch config)
# Duplex: Full (half-duplex causes many issues)
# Link detected: yes (no = physical problem)

# Cisco switch: check interface
show interface GigabitEthernet1/0/1
# Look for: line protocol is up (down = physical problem)
# Input errors, CRC errors = bad cable
# show interface status → shows speed/duplex/vlan

# Common physical issues:
# - Wrong cable type (straight vs crossover - auto-MDI usually handles this)
# - Duplex mismatch (auto vs forced)
# - Bad SFP/transceiver
# - Flapping link (check: show interface | inc CRC|error|flap)
\`\`\`

## Layer 2: Data Link

\`\`\`bash
# Check ARP table (MAC address resolution)
ip neigh show          # Linux
arp -a                 # Windows/Linux

# If missing neighbor entry:
ping 192.168.1.1 -c 3  # Trigger ARP
ip neigh show 192.168.1.1

# Cisco: check MAC address table
show mac address-table | include Gi1/0/1

# Verify VLAN configuration
show vlan brief          # What VLANs exist
show interface Gi1/0/1 trunk   # Is trunk configured correctly?
show interface Gi1/0/1 switchport  # What VLAN is access port in?

# Spanning Tree issues (Layer 2 loops cause broadcast storms)
show spanning-tree vlan 10
# Look for: Root bridge, port states (FWD, BLK, LRN)
\`\`\`

## Layer 3: Network

\`\`\`bash
# Basic connectivity test
ping 192.168.1.1       # Default gateway
ping 8.8.8.8           # Internet (bypasses DNS)
ping google.com        # DNS + internet

# Trace the path
traceroute 8.8.8.8          # Linux (UDP by default)
tracert 8.8.8.8             # Windows (ICMP)
traceroute -I 8.8.8.8       # Linux with ICMP (like Windows)

# Check routing table
ip route show          # Linux
route print            # Windows
show ip route          # Cisco

# Check if route exists for destination
ip route get 8.8.8.8   # Linux: shows which route/interface will be used

# MTU issues (large packets failing but small ones working)
# Test with different sizes
ping -s 1472 -M do 192.168.1.1    # Test 1500 byte frame
ping -s 1000 -M do 192.168.1.1    # Test smaller frame
# If large fails but small works: MTU mismatch
\`\`\`

## Layer 4: Transport (TCP/UDP)

\`\`\`bash
# Test if port is open
nc -zv 192.168.1.50 80       # Netcat: connect to port 80
nc -zv -u 192.168.1.50 53    # UDP port 53
telnet 192.168.1.50 80        # Old way

# Show listening ports
ss -tlnp             # Linux (ss replaces netstat)
netstat -an          # Windows

# Show established connections
ss -t state established
# Check connection states: ESTABLISHED, TIME_WAIT, FIN_WAIT

# Capture packets to see what's happening
tcpdump -i eth0 host 192.168.1.50 and port 80 -w capture.pcap
tcpdump -i eth0 -n "tcp[tcpflags] & (tcp-syn|tcp-rst) != 0"  # SYN/RST only

# Read capture file
tcpdump -r capture.pcap
# Or open in Wireshark: wireshark capture.pcap
\`\`\`

## Layer 7: Application

\`\`\`bash
# HTTP troubleshooting
curl -v http://web.company.com/         # Verbose HTTP request
curl -v -k https://web.company.com/    # HTTPS (ignore cert)
curl -I http://web.company.com/        # Headers only
curl -o /dev/null -s -w "%{http_code} %{time_connect} %{time_total}
" http://web.company.com/

# DNS troubleshooting
nslookup web.company.com               # Basic lookup
dig web.company.com                    # Detailed lookup
dig web.company.com @8.8.8.8           # Query specific DNS server
dig web.company.com +short             # Just the answer
dig -x 192.168.1.50                    # Reverse lookup
dig web.company.com SOA                # Check zone authority

# SSL/TLS issues
openssl s_client -connect web.company.com:443 -showcerts
# Check: certificate chain, expiry dates
echo | openssl s_client -connect web.company.com:443 2>/dev/null |   openssl x509 -noout -dates
\`\`\`

## Systematic Approach: Real Scenario

\`\`\`
Problem: "Users can't reach the web application"

Step 1: Define the problem precisely
- Who is affected? All users or some?
- What exactly fails? (Error message)
- When did it start? What changed?

Step 2: Layer 1 - Physical
- Check server NIC link (ip link show)
- Check switch port status

Step 3: Layer 2 - Data Link
- Server has valid MAC? (ip link show)
- Switch ARP table has server MAC?

Step 4: Layer 3 - Network
- Server has correct IP/mask/gateway? (ip addr show)
- Can server ping gateway? (ping 192.168.1.1)
- Can gateway ping server?
- Can client ping server by IP?

Step 5: Layer 4 - Transport
- Is nginx/Apache listening? (ss -tlnp | grep :80)
- Does client successfully TCP connect? (nc -zv server 80)
- Is a firewall blocking? (iptables -L, check security groups)

Step 6: Layer 7 - Application
- Does curl return correct response from server?
- Are there application errors in logs?
- Is DNS resolving correctly?
\`\`\`

## Useful Tools Summary

\`\`\`bash
# Physical/Link
ethtool eth0              # Link speed, duplex, driver info
mii-tool eth0             # Media-independent interface status

# Layer 2
arp -n                    # ARP cache
ip neigh                  # Neighbor (ARP/NDP) table

# Layer 3
ip route                  # Routing table
ip route get X.X.X.X      # Which route used for destination
traceroute                # Path to destination

# Layer 4
ss -tlnp                  # Listening TCP sockets
ss -ulnp                  # Listening UDP sockets
tcpdump                   # Packet capture

# Application
curl -v                   # HTTP debugging
dig / nslookup            # DNS
openssl s_client          # TLS debugging
\`\`\`

Network troubleshooting mastery comes from one habit: always follow the OSI model from Layer 1 up, never skip layers, and gather evidence at each layer before moving to the next. The methodology turns "random guessing" into systematic diagnosis.
`,
    contentFa: `## مقدمه

عیب‌یابی سیستماتیک شبکه مهارتی است که مهندسان با تجربه را از مبتدیان متمایز می‌کند. بدون روش‌شناسی، عیب‌یابی تصادفی و وقت‌گیر می‌شود. این راهنما چارچوب عیب‌یابی مبتنی بر مدل OSI را آموزش می‌دهد.

## چارچوب OSI

\`\`\`
لایه ۷ - Application: آیا اپلیکیشن ارتباط دارد؟
لایه ۴ - Transport: آیا اتصالات TCP/UDP کار می‌کنند؟
لایه ۳ - Network: آیا مسیریابی IP درست است؟
لایه ۲ - Data Link: آیا MAC address ها resolve می‌شوند؟
لایه ۱ - Physical: آیا کابل/لینک واقعاً کار می‌کند؟
\`\`\`

## عیب‌یابی لایه به لایه

\`\`\`bash
# لایه ۱ - Physical
ethtool eth0 | grep -E "Speed|Duplex|Link"
ip link show eth0

# لایه ۲ - Data Link
ip neigh show
ping 192.168.1.1 -c 3  # trigger ARP

# لایه ۳ - Network
ping 8.8.8.8      # اینترنت (بدون DNS)
traceroute 8.8.8.8
ip route get 8.8.8.8   # نشان می‌دهد کدام route/interface استفاده می‌شود

# لایه ۴ - Transport
ss -tlnp             # پورت‌های listening
nc -zv server 80     # تست اتصال TCP
tcpdump -i eth0 host server and port 80

# لایه ۷ - Application
curl -v http://web.company.com/
dig web.company.com @8.8.8.8
openssl s_client -connect web.company.com:443
\`\`\`

تسلط بر عیب‌یابی شبکه از یک عادت می‌آید: همیشه مدل OSI را از لایه ۱ به بالا دنبال کنید، هیچ‌گاه لایه‌ها را رد نکنید و در هر لایه قبل از رفتن به لایه بعدی شواهد جمع کنید.
`,
  },
  'cisco-catalyst-vlan-setup': {
    contentEn: `## Introduction

Cisco Catalyst switches are the most widely deployed enterprise switching platform. VLAN configuration on Catalyst switches is a fundamental skill — getting it wrong causes network outages, security violations (traffic leaking between VLANs), and performance issues. This guide covers VLAN setup, inter-VLAN routing, trunking, and VTP management in production Catalyst deployments.

## VLAN Fundamentals

\`\`\`
VLANs separate a physical switch into multiple logical networks:

Physical: One switch, 24 ports
Logical:
  VLAN 10: Users    (ports 1-12)
  VLAN 20: Servers  (ports 13-18)
  VLAN 30: Printers (ports 19-22)
  VLAN 99: Native   (trunk)

Benefits:
- Security: VLANs can't communicate by default
- Performance: Broadcast domains are smaller
- Management: Logical grouping regardless of physical location
\`\`\`

## Creating and Managing VLANs

\`\`\`
! Create VLANs in global configuration
vlan 10
  name USERS
vlan 20
  name SERVERS
vlan 30
  name PRINTERS
vlan 99
  name NATIVE

! Verify
show vlan brief
! Output:
! VLAN Name              Status    Ports
! ---- ----------------  --------- --------------------
! 10   USERS             active    Gi1/0/1, Gi1/0/2
! 20   SERVERS           active    Gi1/0/13
\`\`\`

## Access Ports (End Devices)

\`\`\`
! Configure access port for end device
interface GigabitEthernet1/0/1
  description PC-John
  switchport mode access
  switchport access vlan 10
  switchport nonegotiate         ! Don't negotiate DTP
  spanning-tree portfast         ! Instant connectivity for end devices
  spanning-tree bpduguard enable ! Protect against loops from this port
  no shutdown

! Configure multiple ports at once
interface range GigabitEthernet1/0/1-12
  description USERS-PORTS
  switchport mode access
  switchport access vlan 10
  spanning-tree portfast
  spanning-tree bpduguard enable
  no shutdown
\`\`\`

## Trunk Ports (Switch-to-Switch and Switch-to-Router)

\`\`\`
! Configure trunk port to another switch/router
interface GigabitEthernet1/0/24
  description Uplink-to-Core-SW01
  switchport mode trunk
  switchport trunk encapsulation dot1q    ! Required on older IOS
  switchport trunk native vlan 99        ! Untagged traffic goes here
  switchport trunk allowed vlan 10,20,30,99  ! Only allow specific VLANs
  switchport nonegotiate                 ! Disable DTP negotiation

! Verify trunk
show interface GigabitEthernet1/0/24 trunk
! Output shows:
! Port        Mode    Encapsulation  Status    Native vlan
! Gi1/0/24    on      802.1q         trunking  99
! VLANs allowed and active in management domain: 10,20,30,99
\`\`\`

## VTP (VLAN Trunking Protocol)

\`\`\`
! VTP manages VLAN config across multiple switches
! WARNING: VTP can cause catastrophic VLAN deletion if misconfigured

! Best practice for most shops: Use VTP transparent mode (no sync)
vtp mode transparent   ! Don't sync, just pass VTP messages

! Or disable VTP entirely (IOS 15.2+ supports VTP version 3)
no vtp

! If you must use VTP server/client:
vtp domain COMPANY
vtp password VTPSecret123
vtp version 2
vtp mode server   ! Only on core switch

! Client switches:
vtp domain COMPANY
vtp password VTPSecret123
vtp mode client
\`\`\`

## Inter-VLAN Routing

VLANs can't communicate without routing. Three options:

**Option 1: Router-on-a-Stick** (one physical link, subinterfaces):
\`\`\`
! On Cisco router:
interface GigabitEthernet0/0.10
  encapsulation dot1Q 10
  ip address 10.10.10.1 255.255.255.0

interface GigabitEthernet0/0.20
  encapsulation dot1Q 20
  ip address 10.20.20.1 255.255.255.0

interface GigabitEthernet0/0.99
  encapsulation dot1Q 99 native
  ip address 10.99.99.1 255.255.255.0
\`\`\`

**Option 2: Layer 3 Switch (SVIs)** — Best for enterprise:
\`\`\`
! Enable IP routing on Catalyst (Layer 3 switches only)
ip routing

! Create SVI (Switch Virtual Interface)
interface Vlan10
  description Users-Gateway
  ip address 10.10.10.1 255.255.255.0
  ip helper-address 192.168.100.10   ! Forward DHCP to server
  no shutdown

interface Vlan20
  description Servers-Gateway
  ip address 10.20.20.1 255.255.255.0
  no shutdown

! Routed uplink to core
interface GigabitEthernet1/0/24
  no switchport          ! Convert to routed port
  ip address 10.0.0.2 255.255.255.252

ip route 0.0.0.0 0.0.0.0 10.0.0.1   ! Default route to core
\`\`\`

## Security: VLAN Hardening

\`\`\`
! Disable unused ports and put in unused VLAN
interface range GigabitEthernet1/0/1-24
  shutdown    ! Default all ports off

! Configure secure port
interface GigabitEthernet1/0/5
  description Reception-PC
  switchport mode access
  switchport access vlan 10
  switchport port-security
  switchport port-security maximum 1         ! Only 1 MAC allowed
  switchport port-security violation restrict ! Log but don't shut down
  switchport port-security mac-address sticky ! Learn current MAC

! DHCP Snooping (prevents rogue DHCP servers)
ip dhcp snooping
ip dhcp snooping vlan 10,20,30
no ip dhcp snooping information option

! Trusted ports (legitimate DHCP server location)
interface GigabitEthernet1/0/24
  ip dhcp snooping trust

! Dynamic ARP Inspection (prevents ARP spoofing)
ip arp inspection vlan 10,20,30
interface GigabitEthernet1/0/24
  ip arp inspection trust
\`\`\`

## Troubleshooting VLANs

\`\`\`
! Device can't communicate
! Step 1: Verify port is in correct VLAN
show interfaces GigabitEthernet1/0/5 switchport
! Look for: Access Mode VLAN: 10

! Step 2: Verify VLAN exists and is active
show vlan id 10

! Step 3: Verify trunk allows VLAN
show interfaces GigabitEthernet1/0/24 trunk
! Look for: VLANs allowed and active: 10,...

! Step 4: Verify SVI is up
show interface Vlan10
! Must be: Vlan10 is up, line protocol is up
! If down: no active ports in VLAN 10

! Step 5: Check routing
show ip route 10.10.10.0
ping 10.10.10.1 source Vlan20  ! Test inter-VLAN routing

! Common mistake: native VLAN mismatch
show interfaces trunk | include Native
! Both sides must agree on native VLAN
\`\`\`

Cisco Catalyst VLAN configuration is the most fundamental enterprise switching skill. The key principle: always explicitly configure trunk allowed VLANs (don't allow all), use transparent VTP or disable it to prevent accidental VLAN deletion, and use Layer 3 switching SVIs for inter-VLAN routing at enterprise scale.
`,
    contentFa: `## مقدمه

سوئیچ‌های Cisco Catalyst پرکاربردترین پلتفرم سوئیچینگ سازمانی هستند. پیکربندی VLAN روی سوئیچ‌های Catalyst یک مهارت اساسی است - اشتباه در آن باعث قطعی شبکه، نقض امنیت و مشکلات عملکردی می‌شود.

## مدیریت VLAN

\`\`\`
vlan 10
  name USERS
vlan 20
  name SERVERS
vlan 30
  name PRINTERS

show vlan brief
\`\`\`

## پورت‌های Access

\`\`\`
interface range GigabitEthernet1/0/1-12
  switchport mode access
  switchport access vlan 10
  spanning-tree portfast
  spanning-tree bpduguard enable
  no shutdown
\`\`\`

## پورت‌های Trunk

\`\`\`
interface GigabitEthernet1/0/24
  switchport mode trunk
  switchport trunk native vlan 99
  switchport trunk allowed vlan 10,20,30,99
  switchport nonegotiate  # غیرفعال کردن DTP
\`\`\`

## Inter-VLAN Routing با SVI

\`\`\`
ip routing

interface Vlan10
  ip address 10.10.10.1 255.255.255.0
  ip helper-address 192.168.100.10  # DHCP forwarding
  no shutdown
\`\`\`

## امنیت VLAN

\`\`\`
! DHCP Snooping
ip dhcp snooping
ip dhcp snooping vlan 10,20,30

! Dynamic ARP Inspection
ip arp inspection vlan 10,20,30

! Port Security
interface GigabitEthernet1/0/5
  switchport port-security maximum 1
  switchport port-security violation restrict
  switchport port-security mac-address sticky
\`\`\`

پیکربندی VLAN سیسکو اساسی‌ترین مهارت سوئیچینگ سازمانی است. همیشه VLAN های مجاز در trunk را به‌صراحت پیکربندی کنید و از VTP transparent یا غیرفعال استفاده کنید.
`,
  },
  'infrastructure-as-code-principles': {
    contentEn: `## Introduction

Infrastructure as Code (IaC) means managing and provisioning infrastructure through machine-readable configuration files rather than manual processes or interactive configuration tools. It's not just "using Terraform" — it's a set of principles and practices that transform how organizations build and maintain infrastructure. This guide teaches the core principles and how to apply them with modern tools.

## The Core Principles of IaC

**1. Declarative vs Imperative**

\`\`\`
Imperative (how to do it):
"Create a server, then install nginx, then configure port 80"
- Fragile: what if server already exists?
- Not idempotent

Declarative (what should exist):
"There should be a server running nginx on port 80"
- Tool figures out HOW to make it so
- Idempotent: running twice gives same result
- Examples: Terraform (declarative), Ansible playbooks (can be either)
\`\`\`

**2. Idempotency**

\`\`\`hcl
# This Terraform block is idempotent
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t3.medium"
  tags = {
    Name = "web-server"
  }
}
# Run once: creates instance
# Run again: no change (already correct)
# Run with different instance_type: modifies in place or replaces
\`\`\`

**3. Version Control Everything**

\`\`\`
Your infrastructure code should be in Git:
infrastructure/
├── terraform/
│   ├── modules/
│   └── environments/
│       ├── staging/
│       └── production/
├── ansible/
│   ├── roles/
│   └── playbooks/
└── kubernetes/
    └── manifests/

Benefits:
- Every change has author, timestamp, reason (commit message)
- Roll back infrastructure like you roll back code
- Branch and test infrastructure changes before merging
- Code review for infrastructure changes (prevents mistakes)
\`\`\`

**4. Immutable Infrastructure**

\`\`\`
Mutable (traditional):
Deploy server → SSH in → Update nginx config → Reload nginx
Problem: Configuration drift (servers diverge over time)

Immutable:
Update config in code → Build new AMI/container → Deploy new version → Destroy old
Benefits:
- No configuration drift (every server identical)
- Easy to test (know exactly what's in the image)
- Rollback = deploy previous image version
\`\`\`

## Terraform: State Management

\`\`\`hcl
# terraform.tf - Configure remote state storage
terraform {
  required_version = ">= 1.0"

  backend "s3" {
    bucket = "company-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"

    # State locking (prevent concurrent runs)
    dynamodb_table = "company-terraform-locks"
    encrypt        = true
  }
}

# State stores current infrastructure reality
# NEVER edit terraform.tfstate manually
# Use: terraform state list    (see what's tracked)
#      terraform state show    (see details)
#      terraform state mv      (rename resource)
#      terraform state rm      (stop tracking resource)
\`\`\`

## Drift Detection and Enforcement

\`\`\`bash
# Terraform: detect if real infrastructure drifted from code
terraform plan
# If output shows changes even though you didn't change code:
# Someone made manual changes → DRIFT detected

# Fix drift: apply to bring back to desired state
terraform apply

# Or import the manual change into state:
terraform import aws_instance.web i-1234567890abcdef0

# Ansible: check mode (detect drift without changing)
ansible-playbook site.yml --check --diff
# Shows: would change X, Y, Z (doesn't actually change)
\`\`\`

## Environment Promotion Pattern

\`\`\`
code/
└── terraform/
    └── environments/
        ├── dev/          ← First deployed here
        │   └── main.tf   (calls modules with dev values)
        ├── staging/      ← Same code, different variables
        │   └── main.tf
        └── production/   ← Same code, larger scale
            └── main.tf

# All environments use same modules:
module "vpc" {
  source = "../../modules/vpc"
  cidr   = var.vpc_cidr  # dev: 10.0.0.0/16, prod: 10.1.0.0/16
}

module "eks" {
  source        = "../../modules/eks"
  min_nodes     = var.min_nodes     # dev: 2, prod: 10
  instance_type = var.instance_type # dev: t3.medium, prod: m5.xlarge
}
\`\`\`

## Testing Infrastructure Code

\`\`\`bash
# Terraform: validate syntax and logic
terraform validate
terraform fmt -check

# Security scan
tfsec ./
checkov -d ./

# Integration test with Terratest (Go)
go test -v ./test/ -timeout 30m

# Ansible: lint roles
ansible-lint roles/nginx/
yamllint roles/nginx/

# Molecule: test Ansible roles in containers
molecule test
\`\`\`

## GitOps for Infrastructure

\`\`\`yaml
# .github/workflows/terraform.yml
name: Terraform CI/CD

on:
  pull_request:
    paths: ['terraform/**']

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Terraform Plan
        run: |
          terraform init
          terraform plan -out=plan.tfplan
        env:
          TF_VAR_environment: staging

      - name: Cost Estimate (Infracost)
        uses: infracost/actions/setup@v2
        with:
          api-key: \${{ secrets.INFRACOST_API_KEY }}
      - run: infracost diff --path=plan.tfplan

  apply:
    if: github.ref == 'refs/heads/main'
    needs: plan
    environment: staging    # Requires approval
    steps:
      - run: terraform apply plan.tfplan
\`\`\`

## Documentation as Code

\`\`\`hcl
# Good IaC is self-documenting:
resource "aws_security_group" "web" {
  name        = "web-tier-sg"
  description = "Allow HTTP/HTTPS from internet, all traffic to app tier"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "App tier communication"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name        = "web-tier-sg"
    Environment = var.environment
    Team        = "platform"
    # No "ManagedBy" tag needed — if it's in Terraform, it's managed by Terraform
  }
}
\`\`\`

Infrastructure as Code is a cultural shift as much as a technical one: infrastructure changes through pull requests, reviewed and approved, then automatically applied. This eliminates the "snowflake servers" problem and gives you confidence that your infrastructure matches your documentation — because they're the same thing.
`,
    contentFa: `## مقدمه

Infrastructure as Code (IaC) به معنای مدیریت و تأمین زیرساخت از طریق فایل‌های پیکربندی قابل خواندن توسط ماشین است. این فقط "استفاده از Terraform" نیست - مجموعه‌ای از اصول و شیوه‌ها است که نحوه ساخت و نگهداری زیرساخت را متحول می‌کند.

## اصول اصلی IaC

**۱. اعلانی (Declarative)**
\`\`\`hcl
# نه "چطور" بلکه "چه چیزی باید وجود داشته باشد"
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t3.medium"
}
# اجرای اول: ایجاد instance
# اجرای دوم: تغییری نیست (Idempotent)
\`\`\`

**۲. کنترل نسخه**
\`\`\`
infrastructure/
├── terraform/environments/
│   ├── staging/
│   └── production/
├── ansible/roles/
└── kubernetes/manifests/
\`\`\`

**۳. Immutable Infrastructure**
\`\`\`
به جای SSH و تغییر پیکربندی:
Update config → Build new image → Deploy new version → Destroy old
\`\`\`

## مدیریت State

\`\`\`hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "production/terraform.tfstate"
    dynamodb_table = "company-terraform-locks"  # قفل‌گذاری concurrent
    encrypt        = true
  }
}
\`\`\`

## تشخیص Drift

\`\`\`bash
terraform plan  # تشخیص تغییرات غیرمجاز
# اگر تغییراتی نشان داد بدون تغییر کد: DRIFT شناسایی شد

# بررسی بدون تغییر در Ansible
ansible-playbook site.yml --check --diff
\`\`\`

## الگوی ارتقاء محیط

\`\`\`
dev → staging → production (کد یکسان، متغیرهای مختلف)
\`\`\`

IaC یک تغییر فرهنگی به همان اندازه که تکنیکی است: تغییرات زیرساخت از طریق pull request، بررسی و تأیید، سپس به‌صورت خودکار اعمال می‌شوند.
`,
  },

  'mikrotik-what-is-introduction': {
    contentEn: `## What Is MikroTik?

MikroTik is a Latvian network equipment manufacturer best known for **RouterOS**, a powerful operating system that turns ordinary hardware (or MikroTik's own RouterBOARD devices) into enterprise-grade routers, switches, firewalls, and wireless access points. For network engineers, IT students, and small ISPs, MikroTik is attractive because a single low-cost device can replace functionality that would otherwise require several expensive appliances from larger vendors.

This post is the starting point of a complete "zero to hero" MikroTik curriculum. We assume you know nothing about MikroTik yet, so we will go slowly and build a solid foundation before moving into configuration in later posts.

### Why Engineers Choose MikroTik

- **Cost efficiency**: Hardware and licensing cost a fraction of comparable Cisco/Juniper gear.
- **RouterOS feature set**: Routing (static, OSPF, BGP), firewall, VPN (IPsec, WireGuard, PPTP/L2TP), QoS, wireless, hotspot, and scripting — all in one OS.
- **CLI and GUI both available**: You can configure everything through the command line, the Winbox desktop tool, or the WebFig browser interface.
- **Scriptability**: RouterOS has its own scripting language for automation, alerts, and scheduled maintenance.

### The RouterOS Architecture

RouterOS is built on a Linux kernel but exposes its own command structure organized into **menus**, similar to a filesystem:

\`\`\`
/ip address
/ip route
/ip firewall filter
/interface bridge
/system identity
\`\`\`

Every configuration item lives under a menu path. For example, to see all configured IP addresses you would run:

\`\`\`
/ip address print
\`\`\`

### Hardware vs RouterOS-only

MikroTik sells physical devices called **RouterBOARD** (and the newer **RB**/**CRS**/**CCR** product lines), but RouterOS can also run as software on standard x86 hardware or in a virtual machine (CHR — Cloud Hosted Router). This means you can practice everything in this course using a free CHR trial license inside VirtualBox or any VM platform, no physical hardware required.

### What You Will Learn in This Course

Over the next 29 posts we will progress through:

1. Hardware basics and licensing
2. First connection via Winbox/WebFig/SSH
3. IP addressing, DHCP, and basic routing
4. Firewall fundamentals and NAT
5. Wireless and bridging
6. DNS, PPPoE, and user management
7. Backups, upgrades, logging, and monitoring
8. Bandwidth shaping (queues)
9. Automation with scripting and scheduler
10. VPNs (IPsec, PPTP/L2TP) and centralized wireless management (CAPsMAN)

By the end of this series you will be comfortable configuring a MikroTik router from a factory-reset state to a fully functioning, secured, production network device.

### A Note on Terminology

Throughout this course you will see these recurring terms:

- **Identity**: the device's hostname.
- **Interface**: any physical or virtual network port (ether1, wlan1, bridge1, etc.).
- **RouterOS version**: we will mostly reference RouterOS v7, the current major branch with WireGuard support and improved routing.
- **Winbox**: the native MikroTik configuration GUI (Windows/Wine, connects over a special discovery protocol or IP).

In the next post we will look at MikroTik's hardware lineup so you understand which device class fits which use case before we start configuring.`,
    contentFa: `## میکروتیک چیست؟

میکروتیک (MikroTik) یک شرکت سازنده تجهیزات شبکه از کشور لتونی است که بیشتر به خاطر سیستم‌عامل **RouterOS** شناخته می‌شود. این سیستم‌عامل سخت‌افزارهای معمولی یا دستگاه‌های RouterBOARD خود میکروتیک را به روتر، سوییچ، فایروال و اکسس‌پوینت بی‌سیم در سطح سازمانی تبدیل می‌کند. برای مهندسان شبکه، دانشجویان IT و ISPهای کوچک، میکروتیک جذاب است چون یک دستگاه کم‌هزینه می‌تواند جای چند دستگاه گران‌قیمت از برندهای بزرگ‌تر را بگیرد.

این پست نقطه شروع یک دوره کامل "صفر تا صد" میکروتیک است. فرض می‌کنیم هیچ چیزی درباره میکروتیک نمی‌دانید، پس آرام پیش می‌رویم و قبل از ورود به تنظیمات، یک پایه قوی می‌سازیم.

### چرا مهندسان میکروتیک را انتخاب می‌کنند؟

- **صرفه‌جویی هزینه**: سخت‌افزار و لایسنس بخش کوچکی از هزینه تجهیزات مشابه سیسکو یا جونیپر را دارد.
- **مجموعه قابلیت‌های RouterOS**: روتینگ (استاتیک، OSPF، BGP)، فایروال، VPN (IPsec، WireGuard، PPTP/L2TP)، کیفیت سرویس (QoS)، وایرلس، هات‌اسپات و اسکریپت‌نویسی — همه در یک سیستم‌عامل.
- **دسترسی هم با CLI و هم GUI**: می‌توانید همه چیز را از طریق خط فرمان، ابزار دسکتاپ Winbox یا رابط مرورگری WebFig تنظیم کنید.
- **قابلیت اسکریپت‌نویسی**: RouterOS زبان اسکریپت‌نویسی مخصوص خود را دارد که برای اتوماسیون، هشدارها و نگهداری زمان‌بندی‌شده استفاده می‌شود.

### معماری RouterOS

RouterOS بر پایه کرنل لینوکس ساخته شده، اما ساختار فرمان‌های خاص خودش را به شکل **منو**ها شبیه فایل‌سیستم نشان می‌دهد:

\`\`\`
/ip address
/ip route
/ip firewall filter
/interface bridge
/system identity
\`\`\`

هر آیتم تنظیمات زیر یک مسیر منو قرار دارد. مثلاً برای دیدن همه آی‌پی‌های تنظیم‌شده می‌نویسید:

\`\`\`
/ip address print
\`\`\`

### سخت‌افزار در مقابل RouterOS به‌تنهایی

میکروتیک دستگاه‌های فیزیکی به نام **RouterBOARD** (و سری‌های جدیدتر RB، CRS، CCR) می‌فروشد، اما RouterOS می‌تواند به‌صورت نرم‌افزار روی سخت‌افزار x86 معمولی یا در یک ماشین مجازی (CHR — Cloud Hosted Router) هم اجرا شود. یعنی می‌توانید تمام تمرین‌های این دوره را با یک لایسنس آزمایشی رایگان CHR داخل VirtualBox یا هر پلتفرم مجازی‌سازی دیگری انجام دهید، بدون نیاز به سخت‌افزار فیزیکی.

### در این دوره چه چیزی یاد خواهید گرفت؟

در ۲۹ پست آینده مراحل زیر را طی می‌کنیم:

۱. اصول سخت‌افزار و لایسنس
۲. اولین اتصال از طریق Winbox/WebFig/SSH
۳. آی‌پی‌دهی، DHCP و روتینگ پایه
۴. اصول فایروال و NAT
۵. وایرلس و بریجینگ
۶. DNS، PPPoE و مدیریت کاربران
۷. بکاپ، آپگرید، لاگ‌گیری و مانیتورینگ
۸. شکل‌دهی پهنای باند (Queue)
۹. اتوماسیون با اسکریپت‌نویسی و Scheduler
۱۰. VPN (IPsec، PPTP/L2TP) و مدیریت متمرکز وایرلس (CAPsMAN)

در پایان این سری، شما می‌توانید یک دستگاه میکروتیک را از حالت فکتوری‌ریست تا یک دستگاه شبکه کاملاً کارکردی و امن در محیط تولید پیکربندی کنید.

### نکته‌ای درباره اصطلاحات

در طول این دوره با این اصطلاحات تکرارشونده مواجه می‌شوید:

- **Identity**: نام میزبان دستگاه.
- **Interface**: هر پورت فیزیکی یا مجازی شبکه (ether1، wlan1، bridge1 و غیره).
- **نسخه RouterOS**: ما بیشتر به RouterOS v7 ارجاع می‌دهیم، شاخه اصلی فعلی با پشتیبانی از WireGuard و روتینگ بهبودیافته.
- **Winbox**: ابزار رابط گرافیکی بومی میکروتیک (ویندوز/واین، اتصال از طریق پروتکل discovery یا آی‌پی).

در پست بعدی به سراغ خط محصولات سخت‌افزاری میکروتیک می‌رویم تا قبل از شروع تنظیمات بدانید کدام کلاس دستگاه برای کدام کاربرد مناسب است.`,
  },
  'mikrotik-routerboard-hardware-guide': {
    contentEn: `
## MikroTik Hardware Families: A Complete Beginner Guide

If you are new to MikroTik, the first thing you will notice is that MikroTik sells many different devices. Some look like home routers, some look like data-center switches, and some are bare circuit boards. This guide walks you through every major hardware family so you can choose the right device for your project.

## What Is RouterBOARD?

RouterBOARD is the brand name MikroTik uses for its bare-board and enclosure-based network devices that run RouterOS. Think of RouterBOARD as the platform: the combination of hardware and the RouterOS operating system installed on it.

Almost all MikroTik devices sold today are RouterBOARD products. When you buy a MikroTik device you get:

- The hardware (CPU, RAM, flash storage, Ethernet ports, optional wireless chips)
- RouterOS pre-installed on the device
- A RouterOS license bundled with the hardware (no separate purchase needed for most devices)

## Major Hardware Families

### hAP and hAP ac — Home and Small Office Routers

The **hAP** (home Access Point) series is designed for home users and small offices. These devices have:

- 5 Ethernet ports (usually 1 WAN + 4 LAN)
- Built-in wireless (2.4 GHz on hAP, dual-band 2.4/5 GHz on hAP ac models)
- Compact plastic enclosure
- Low power consumption
- Price range: $30 to $80 USD

Popular models: hAP ac2, hAP ac3, hAP ax2 (Wi-Fi 6)

**Best for:** Home users, small offices, beginners learning RouterOS.

### hEX Series — Small Wired Routers

The **hEX** series is similar to hAP but without wireless. These are pure wired routers:

- 5 Gigabit Ethernet ports
- Small plastic enclosure
- Very affordable ($50 to $70 USD)
- Some models include SFP port or USB

Popular models: hEX, hEX S, hEX lite

**Best for:** Wired-only environments, branch offices, users who have a separate access point.

### RB Series (RouterBOARD Boards)

The **RB** prefix indicates a bare RouterBOARD without an enclosure, or a specialized device. Examples:

- **RB750Gr3** — budget 5-port Gigabit router
- **RB4011** — high-performance 10-port router with SFP+
- **RB3011** — 10-port router popular in small ISPs

These range from $50 to $200 USD and are very popular with ISPs and network engineers.

### CRS — Cloud Router Switches

**CRS** (Cloud Router Switch) devices are Layer 2/Layer 3 switches with full RouterOS. They have:

- Many Ethernet ports (8, 16, 24, or 48 ports)
- SFP or SFP+ uplink ports for fiber
- Switching ASICs for hardware-accelerated packet forwarding
- Can run either RouterOS or SwitchOS (a simpler switch OS)

Popular models: CRS326-24G-2S+, CRS354-48G-4S+2Q+

**Best for:** Office networks, ISP aggregation, anyone who needs a managed switch with routing capability.

### CCR — Cloud Core Router

**CCR** (Cloud Core Router) devices are MikroTik high-end routers for ISPs and enterprises. They feature:

- Multi-core Tilera or ARM processors (up to 72 cores)
- High throughput (multi-gigabit routing)
- Rack-mount form factor
- Multiple SFP/SFP+ ports
- Price range: $300 to $3000+ USD

Popular models: CCR2004-1G-12S+2XS, CCR1036-8G-2S+

**Best for:** Internet service providers, enterprise networks, high-bandwidth environments.

### LHG, SXT, LDF — Outdoor Wireless Devices

MikroTik also makes outdoor point-to-point and point-to-multipoint wireless devices:

- **LHG** — Lightweight High Gain dish antenna, for long-distance links
- **SXT** — Small sector/dish for short-to-medium wireless links
- **LDF** — LTE/4G device for cellular backhaul

**Best for:** Wireless ISPs (WISPs), outdoor coverage, building-to-building links.

## RouterOS License Levels

RouterOS comes in several license levels. The higher the level, the more features are unlocked.

| Level | Typical Use |
|-------|-------------|
| Level 1 | Free/Demo — very limited, mostly for testing |
| Level 3 | ISP Wireless — wireless client, CPE devices |
| Level 4 | WISP — wireless AP, most home/office features |
| Level 5 | WISP AP — adds hotspot user limit increase |
| Level 6 | Controller — unlimited everything |

**Important:** Almost all physical MikroTik hardware comes with a license already included (usually Level 4 or Level 6 depending on the device). You only need to buy a separate license if you are installing RouterOS on a standard PC (called CHR — Cloud Hosted Router).

### CHR (Cloud Hosted Router)

CHR is RouterOS installed as a virtual machine on a server or cloud provider. Licensing for CHR:

- **Free trial** — 1 Mbps throughput limit
- **P1** — $45/year — 1 Gbps limit
- **P10** — $95/year — 10 Gbps limit
- **P-Unlimited** — $250/year — no limit

## How to Pick the Right Hardware

Use this simple guide:

- **Home/small office with wireless** — hAP ac2 or hAP ac3
- **Home/small office, wired only** — hEX or hEX S
- **Small business switch** — CRS326 or CRS354
- **ISP edge router, high throughput** — CCR series
- **Outdoor wireless link** — LHG or SXT
- **Learning/testing on a PC or VM** — CHR (free tier works fine for learning)

## Summary

MikroTik hardware ranges from a $30 home router to a $3000 ISP core router, all running the same RouterOS software. Once you learn RouterOS on a cheap hAP device, you can apply that knowledge to any other MikroTik product. Start small, learn the software, then scale up.
`,
    contentFa: `
## راهنمای سخت‌افزار میکروتیک برای مبتدیان

اگر تازه با میکروتیک آشنا شده‌اید، احتمالاً با تنوع زیاد محصولات این شرکت روبرو شده‌اید. در این راهنما همه خانواده‌های سخت‌افزاری میکروتیک را به زبان ساده توضیح می‌دهیم.

## RouterBOARD چیست؟

RouterBOARD نام برند میکروتیک برای دستگاه‌هایی است که سیستم‌عامل RouterOS را اجرا می‌کنند. وقتی یک دستگاه میکروتیک می‌خرید، سه چیز با هم دریافت می‌کنید:

- سخت‌افزار (پردازنده، RAM، حافظه فلش، پورت‌های شبکه)
- RouterOS که از قبل نصب شده
- لایسنس RouterOS که با دستگاه همراه است

## خانواده‌های اصلی سخت‌افزار

### سری hAP — روترهای خانگی و اداری کوچک

سری **hAP** برای کاربران خانگی و ادارات کوچک طراحی شده:

- ۵ پورت اترنت (معمولاً ۱ WAN و ۴ LAN)
- وای‌فای داخلی (۲.۴ گیگاهرتز یا دوباند در مدل‌های ac)
- قیمت: ۳۰ تا ۸۰ دلار

مدل‌های پرطرفدار: hAP ac2، hAP ac3، hAP ax2

**مناسب برای:** کاربران خانگی، ادارات کوچک، مبتدیانی که می‌خواهند RouterOS یاد بگیرند.

### سری hEX — روترهای سیمی کوچک

سری **hEX** مثل hAP است اما بدون وای‌فای:

- ۵ پورت گیگابیت اترنت
- قیمت مناسب (۵۰ تا ۷۰ دلار)

**مناسب برای:** محیط‌های بدون نیاز به وای‌فای، دفاتر کوچک.

### سری CRS — سوئیچ‌های هوشمند

دستگاه‌های **CRS** ترکیبی از سوئیچ و روتر هستند:

- ۸ تا ۴۸ پورت اترنت
- پورت‌های SFP برای فیبر نوری
- تسریع سخت‌افزاری در انتقال بسته‌ها

**مناسب برای:** شبکه‌های اداری، ISP‌های کوچک.

### سری CCR — روترهای سطح ISP

دستگاه‌های **CCR** روترهای حرفه‌ای میکروتیک هستند:

- پردازنده‌های چندهسته‌ای قدرتمند
- توان پردازش چند گیگابیت
- فرم رک‌مونت
- قیمت: ۳۰۰ تا ۳۰۰۰ دلار و بیشتر

**مناسب برای:** ISP‌ها، شبکه‌های سازمانی.

### دستگاه‌های وایرلس فضای باز

- **LHG** — آنتن دیشی برای لینک‌های طولانی
- **SXT** — برای لینک‌های کوتاه تا متوسط
- **LDF** — دستگاه LTE/4G برای اتصال سلولی

## سطوح لایسنس RouterOS

| سطح | کاربرد |
|-----|---------|
| Level 1 | آزمایش و تست (محدود) |
| Level 4 | اکثر کاربردهای خانگی و اداری |
| Level 6 | بدون محدودیت — مناسب ISP‌ها |

نکته مهم: تقریباً همه دستگاه‌های فیزیکی میکروتیک با لایسنس همراه هستند.

### CHR — روتر ابری

CHR نسخه‌ای از RouterOS است که روی ماشین مجازی نصب می‌شود. نسخه رایگان آن محدودیت ۱ مگابیت دارد اما برای یادگیری کافی است.

## انتخاب سخت‌افزار مناسب

- **خانه یا اداره کوچک با وای‌فای** — hAP ac2 یا hAP ac3
- **محیط سیمی** — hEX یا hEX S
- **سوئیچ اداری** — CRS326 یا CRS354
- **روتر پرسرعت ISP** — سری CCR
- **یادگیری روی کامپیوتر** — CHR نسخه رایگان

## جمع‌بندی

میکروتیک از روترهای ۳۰ دلاری خانگی تا روترهای ۳۰۰۰ دلاری ISP، همه با همان RouterOS کار می‌کنند. یادگیری RouterOS روی یک دستگاه ارزان‌قیمت به شما اجازه می‌دهد همان دانش را روی هر دستگاه میکروتیک دیگری استفاده کنید.
`,
  },
  'mikrotik-winbox-first-connection': {
    contentEn: `
## Connecting to Your MikroTik for the First Time Using Winbox

Winbox is MikroTik official graphical configuration tool. It is a small Windows application (also runs on Linux/macOS via Wine) that gives you a full graphical interface to RouterOS. For beginners, Winbox is the easiest way to start configuring a MikroTik device.

## Downloading Winbox

1. Go to \`https://mikrotik.com/download\` in your browser.
2. Find the Winbox section and download the latest version for your operating system.
3. Winbox is a single \`.exe\` file — no installation needed. Just download and run it.

On Linux/macOS, you can run Winbox with Wine, or use WebFig (covered in the next lesson) which runs in any browser.

## Factory Default State

A brand-new MikroTik device (or one that has been reset to factory defaults) will have:

- **Login:** \`admin\`
- **Password:** empty (just press Enter) — on newer devices running RouterOS 7.x, the password may be printed on the device label
- **Default IP:** \`192.168.88.1\` on the LAN port (ether2 and higher, depending on model)
- **DHCP server active** on LAN ports — your computer will get an IP like \`192.168.88.x\`

## Connecting via MAC Address (Recommended for First Connection)

The safest way to connect to a fresh MikroTik is via **MAC address**, not IP. This works even if the device has no IP address configured.

Steps:

1. Connect your computer directly to the MikroTik using an Ethernet cable (use ether2 or any LAN port).
2. Open Winbox.
3. Click the **"..."** button next to the Connect To field — this opens the neighbor discovery window.
4. Wait a few seconds. Your MikroTik should appear in the list with its MAC address.
5. Click on the device row to fill in the MAC address automatically.
6. Enter \`admin\` as the username and leave the password blank.
7. Click **Connect**.

You are now connected via MAC address!

## The Quick Set / Default Configuration

When you connect for the first time, RouterOS may show you a **Quick Set** dialog. This is a simplified setup wizard. For learning purposes, it is often better to close it and configure things manually. If you want to use it, fill in the fields and click **Apply**.

## Setting the Admin Password (Critical Safety Step)

The very first thing you should do on any MikroTik is set a strong admin password. Leaving it blank is a serious security risk.

In Winbox:
1. Go to **System > Users**
2. Double-click the \`admin\` user
3. Click **Password** button
4. Enter your new password twice and click **OK**

Or via CLI:

\`\`\`
/user set admin password=YourStrongPassword123
\`\`\`

Write down this password. If you forget it, you will need to reset the device.

## Basic Safety Steps — Avoid Locking Yourself Out

### Do Not Remove the Default Firewall Rules Immediately

A factory-default MikroTik has firewall rules that protect it. Do not delete all firewall rules unless you understand what you are doing.

### Keep at Least One Management Access Method

- Keep an Ethernet cable connected to a LAN port
- Do not block port 8291 (Winbox) or port 22 (SSH) in the firewall INPUT chain on the LAN interface

### Know How to Reset to Factory Defaults

If you lock yourself out:

- **Software reset:** In Winbox go to System > Reset Configuration
- **Hardware reset:** Hold the reset button on the device for 5 seconds while powered on

After a hardware reset, the device returns to factory defaults and you can connect again with \`admin\` and no password.

## Winbox Interface Overview

Once connected, Winbox shows:

- **Left menu:** All RouterOS configuration sections (IP, Interfaces, Wireless, etc.)
- **Top toolbar:** Buttons for safe mode, terminal, neighbors
- **Main area:** Configuration windows open here

### Safe Mode

Winbox has a Safe Mode feature (click the **Safe** button or press Ctrl+X). When safe mode is active:

- Any changes you make are held temporarily
- If your Winbox connection drops, RouterOS automatically rolls back all changes
- This prevents you from accidentally locking yourself out

Always enable Safe Mode before making firewall or IP address changes!

## Connecting via IP Address

Once the device has an IP address (default is \`192.168.88.1\`):

1. Make sure your computer gets an IP from the MikroTik DHCP server
2. In Winbox, type \`192.168.88.1\` in the Connect To field
3. Enter \`admin\` and your password
4. Click **Connect**

## Summary

Winbox makes it easy to configure MikroTik without knowing any CLI commands. Key points:

- Download from \`https://mikrotik.com/download\`
- Connect via MAC address for the safest first connection
- Set the admin password immediately
- Use Safe Mode when making risky changes
- Know how to reset to factory defaults if needed
`,
    contentFa: `
## اتصال اول به میکروتیک با Winbox

Winbox ابزار گرافیکی رسمی میکروتیک برای پیکربندی RouterOS است. برای مبتدیان، Winbox ساده‌ترین روش شروع است.

## دانلود Winbox

۱. به آدرس \`https://mikrotik.com/download\` بروید.
۲. بخش Winbox را پیدا کنید و آخرین نسخه را دانلود کنید.
۳. Winbox یک فایل \`.exe\` تنهاست و نیازی به نصب ندارد.

## حالت پیش‌فرض کارخانه

یک دستگاه میکروتیک جدید یا ریست‌شده این تنظیمات را دارد:

- **نام کاربری:** \`admin\`
- **رمز:** خالی (فقط Enter بزنید) — در دستگاه‌های جدیدتر ممکن است روی برچسب دستگاه نوشته باشد
- **IP پیش‌فرض:** \`192.168.88.1\` روی پورت LAN
- **سرور DHCP فعال** روی پورت‌های LAN

## اتصال از طریق آدرس MAC (توصیه‌شده)

بهترین روش برای اولین اتصال، استفاده از آدرس MAC است:

۱. کامپیوتر خود را با کابل اترنت به پورت LAN میکروتیک (ether2 یا بالاتر) وصل کنید.
۲. Winbox را باز کنید.
۳. روی دکمه **"..."** کنار فیلد Connect To کلیک کنید.
۴. چند ثانیه صبر کنید — دستگاه میکروتیک در لیست نمایش داده می‌شود.
۵. روی ردیف دستگاه کلیک کنید تا آدرس MAC پر شود.
۶. نام کاربری \`admin\` و رمز خالی را وارد کنید.
۷. روی **Connect** کلیک کنید.

## تنظیم رمز عبور مدیر (ضروری)

اولین کاری که باید انجام دهید، تنظیم رمز قوی برای admin است. رها کردن رمز خالی یک خطر امنیتی جدی است.

در Winbox:
۱. به **System > Users** بروید.
۲. روی کاربر \`admin\` دوبار کلیک کنید.
۳. دکمه **Password** را بزنید.
۴. رمز جدید را دو بار وارد کنید و OK کنید.

یا از طریق CLI:

\`\`\`
/user set admin password=YourStrongPassword123
\`\`\`

## نکات ایمنی مهم

### قوانین فایروال پیش‌فرض را حذف نکنید

میکروتیک از کارخانه قوانین فایروال محافظتی دارد. تا زمانی که این قوانین را کاملاً درک نکرده‌اید، آنها را حذف نکنید.

### همیشه یک راه دسترسی داشته باشید

- کابل اترنت به پورت LAN متصل نگه دارید
- پورت ۸۲۹۱ (Winbox) و ۲۲ (SSH) را در فایروال برای LAN باز نگه دارید

### روش ریست دستگاه

اگر از روتر قفل شدید:

- **ریست نرم‌افزاری:** در Winbox به System > Reset Configuration بروید
- **ریست سخت‌افزاری:** دکمه Reset را هنگام روشن بودن دستگاه ۵ ثانیه نگه دارید

## Safe Mode در Winbox

قبل از تغییرات مهم، دکمه **Safe** را بزنید (یا Ctrl+X). در این حالت اگر اتصال Winbox قطع شود، RouterOS تمام تغییرات را به‌طور خودکار برمی‌گرداند.

## اتصال از طریق IP

اگر دستگاه IP دارد (پیش‌فرض: \`192.168.88.1\`):

۱. آدرس \`192.168.88.1\` را در فیلد Connect To وارد کنید.
۲. نام کاربری \`admin\` و رمز را وارد کنید.
۳. روی **Connect** کلیک کنید.

## جمع‌بندی

- Winbox را از \`https://mikrotik.com/download\` دانلود کنید
- برای اولین اتصال از MAC address استفاده کنید
- بلافاصله رمز admin را تنظیم کنید
- قبل از تغییرات مهم، Safe Mode را فعال کنید
`,
  },
  'mikrotik-webfig-ssh-cli': {
    contentEn: `
## WebFig, SSH, and CLI: Three Ways to Configure RouterOS

RouterOS can be configured in three main ways beyond Winbox: **WebFig** (browser-based GUI), **SSH** (secure remote terminal), and the **CLI** (command-line interface). Each has its strengths, and knowing all three makes you a more capable network engineer.

## Comparing Configuration Methods

| Method | Interface | Requires | Best For |
|--------|-----------|----------|----------|
| Winbox | Graphical | Winbox app | Beginners, daily management |
| WebFig | Graphical | Web browser | Remote access without Winbox |
| SSH/CLI | Text | SSH client | Scripting, bulk changes, automation |

## WebFig — Browser-Based Configuration

WebFig is built into RouterOS and accessible from any web browser. No software installation needed.

### Accessing WebFig

1. Make sure your computer can reach the MikroTik
2. Open your browser and go to: \`http://192.168.88.1\`
3. Log in with \`admin\` and your password
4. You will see the WebFig interface — similar layout to Winbox but in a browser

### Security Note

By default, WebFig uses plain HTTP. For production environments, consider disabling HTTP and using HTTPS:

\`\`\`
/ip service set www disabled=yes
/ip service set www-ssl disabled=no
\`\`\`

Restrict which IPs can access it:

\`\`\`
/ip service set www-ssl address=192.168.88.0/24
\`\`\`

## SSH — Secure Remote CLI Access

SSH gives you command-line access to RouterOS from any SSH client.

### Checking SSH Service

\`\`\`
/ip service print
\`\`\`

SSH runs on port 22 by default. To ensure it is enabled:

\`\`\`
/ip service set ssh disabled=no
\`\`\`

### Connecting via SSH

On Linux/macOS:
\`\`\`
ssh admin@192.168.88.1
\`\`\`

On Windows, use PuTTY, Windows Terminal, or any SSH client.

After login you will see the RouterOS CLI prompt:

\`\`\`
[admin@MikroTik] >
\`\`\`

## CLI Navigation Basics

The RouterOS CLI is organized as a hierarchy of menus. Understanding navigation is essential.

### Entering a Menu

Type the menu path and press Enter:

\`\`\`
[admin@MikroTik] > /ip address
[admin@MikroTik] /ip/address>
\`\`\`

The prompt changes to show your current location.

### Going Back to Root

Type \`/\` to jump back to root from anywhere:

\`\`\`
[admin@MikroTik] /ip/address> /
[admin@MikroTik] >
\`\`\`

Type \`..\` to go up one level:

\`\`\`
[admin@MikroTik] /ip/address> ..
[admin@MikroTik] /ip>
\`\`\`

### The ? Help System

Type \`?\` to see available options at any point:

\`\`\`
[admin@MikroTik] > ?
\`\`\`

This lists all top-level menus. Inside a menu, \`?\` shows available subcommands.

### Tab Completion

Press **Tab** after typing a partial command to auto-complete:

\`\`\`
/ip add[TAB]              becomes  /ip address
/ip address add int[TAB]  becomes  /ip address add interface=
\`\`\`

### The print Command

\`print\` shows the current configuration for whatever menu you are in:

\`\`\`
[admin@MikroTik] /ip/address> print
Flags: X - disabled, I - invalid, D - dynamic
 #   ADDRESS            NETWORK         INTERFACE
 0   192.168.88.1/24    192.168.88.0    bridge
\`\`\`

### The set Command

\`set\` modifies an existing entry by number:

\`\`\`
/ip address set 0 address=10.0.0.1/24
\`\`\`

### The add Command

\`add\` creates a new entry:

\`\`\`
/ip address add address=10.0.0.1/24 interface=ether1
\`\`\`

### The remove Command

\`remove\` deletes an entry by number:

\`\`\`
/ip address remove 0
\`\`\`

## Useful CLI Commands for Beginners

\`\`\`
# View system resource usage
/system resource print

# View all interfaces
/interface print

# View IP addresses
/ip address print

# View routing table
/ip route print

# Ping a host
/ping 8.8.8.8 count=4

# Export config to file (backup)
/export file=my-backup

# Undo last change
/undo
\`\`\`

## Absolute Paths vs Relative Navigation

You can run any command from root using its full path without navigating into the menu first:

\`\`\`
/ip address print
/ip address add address=192.168.1.1/24 interface=ether2
/ip dhcp-server print
\`\`\`

This is very useful in scripts where you want to be explicit about location.

## print detail and print where

For more verbose output showing all parameters:

\`\`\`
/ip address print detail
\`\`\`

To filter output:

\`\`\`
/ip address print where interface=ether1
\`\`\`

## CLI Tips

- Use \`/export\` to back up before making major changes
- Use tab completion — it saves time and prevents typos
- Commands are case-insensitive in RouterOS CLI
- Use \`print count-only\` to count entries without listing them

## Summary

WebFig is great when you need browser access without installing Winbox. SSH and CLI are essential for automation, scripting, and managing remote routers. Master the basic navigation (\`/\`, \`..\`, \`print\`, \`set\`, \`add\`, \`remove\`, \`?\`, Tab) and you will be comfortable with RouterOS in no time.
`,
    contentFa: `
## WebFig، SSH و CLI: سه روش پیکربندی RouterOS

علاوه بر Winbox، سه روش دیگر برای پیکربندی RouterOS وجود دارد. دانستن هر سه روش شما را به یک مدیر شبکه کامل تبدیل می‌کند.

## مقایسه روش‌های پیکربندی

| روش | نوع رابط | نیاز دارد به | مناسب برای |
|-----|----------|-------------|------------|
| Winbox | گرافیکی | نرم‌افزار Winbox | مبتدیان، مدیریت روزانه |
| WebFig | گرافیکی | مرورگر وب | دسترسی از راه دور |
| SSH/CLI | متنی | کلاینت SSH | اسکریپت‌نویسی، اتوماسیون |

## WebFig — پیکربندی از طریق مرورگر

WebFig درون RouterOS تعبیه شده و از هر مرورگری قابل دسترس است. نیازی به نصب نرم‌افزار اضافی نیست.

### دسترسی به WebFig

۱. مرورگر را باز کنید و به آدرس \`http://192.168.88.1\` بروید.
۲. با \`admin\` و رمز خود وارد شوید.

### نکته امنیتی

برای جلوگیری از استفاده از HTTP ساده:

\`\`\`
/ip service set www disabled=yes
/ip service set www-ssl disabled=no
/ip service set www-ssl address=192.168.88.0/24
\`\`\`

## SSH — دسترسی ایمن از راه دور

SSH دسترسی خط فرمان ایمن به RouterOS را ممکن می‌کند.

### اتصال از طریق SSH

در Linux/macOS:
\`\`\`
ssh admin@192.168.88.1
\`\`\`

در Windows از PuTTY یا Windows Terminal استفاده کنید.

## اصول ناوبری در CLI

### ورود به منو

\`\`\`
[admin@MikroTik] > /ip address
[admin@MikroTik] /ip/address>
\`\`\`

### برگشت به ریشه

\`\`\`
[admin@MikroTik] /ip/address> /
[admin@MikroTik] >
\`\`\`

یک سطح بالا:

\`\`\`
[admin@MikroTik] /ip/address> ..
[admin@MikroTik] /ip>
\`\`\`

### سیستم راهنما (?)

\`\`\`
[admin@MikroTik] > ?
\`\`\`

همه منوهای سطح بالا را نشان می‌دهد.

### تکمیل خودکار (Tab)

\`\`\`
/ip add[TAB]  -->  /ip address
\`\`\`

### دستورات اصلی

\`\`\`
# نمایش پیکربندی
/ip address print

# اضافه کردن آدرس
/ip address add address=10.0.0.1/24 interface=ether1

# تغییر ورودی موجود
/ip address set 0 address=10.0.0.2/24

# حذف ورودی
/ip address remove 0
\`\`\`

## دستورات مفید برای مبتدیان

\`\`\`
# نمایش منابع سیستم
/system resource print

# نمایش همه اینترفیس‌ها
/interface print

# نمایش آدرس‌های IP
/ip address print

# پینگ
/ping 8.8.8.8 count=4

# بکاپ از پیکربندی
/export file=my-backup

# بازگشت آخرین تغییر
/undo
\`\`\`

## فیلتر کردن خروجی

\`\`\`
/ip address print detail
/ip address print where interface=ether1
\`\`\`

## نکات کاربردی CLI

- قبل از تغییرات مهم از \`/export\` برای بکاپ استفاده کنید
- از Tab completion استفاده کنید
- دستورات به حروف بزرگ/کوچک حساس نیستند

## جمع‌بندی

WebFig وقتی Winbox ندارید مفید است. SSH و CLI برای اتوماسیون و کار با روترهای راه دور ضروری هستند. با یادگیری ناوبری پایه (\`/\`، \`..\`، \`print\`، \`set\`، \`add\`، \`remove\`، \`?\`، Tab) در RouterOS مسلط خواهید شد.
`,
  },
  'mikrotik-ip-addressing-basics': {
    contentEn: `
## IPv4 Addressing on RouterOS: A Beginner Guide

Before a MikroTik router can do anything useful, its interfaces need IP addresses. This lesson covers everything you need to know about assigning and managing IP addresses in RouterOS.

## Quick Review: IP Addresses and Subnets

An IPv4 address is written as four groups of digits separated by dots — for example, \`192.168.1.100\`. Every device on a network needs a unique IP address to communicate.

A **subnet mask** tells you which part of the address identifies the network. The modern way to write this is **CIDR notation** — for example, \`/24\` means the first 24 bits are the network part.

Common subnets:

| CIDR | Subnet Mask | Usable Hosts |
|------|-------------|--------------|
| /24 | 255.255.255.0 | 254 |
| /25 | 255.255.255.128 | 126 |
| /16 | 255.255.0.0 | 65534 |
| /30 | 255.255.255.252 | 2 (point-to-point links) |

## Viewing Existing IP Addresses

\`\`\`
/ip address print
\`\`\`

Example output:

\`\`\`
Flags: X - disabled, I - invalid, D - dynamic
 #   ADDRESS            NETWORK         INTERFACE
 0   192.168.88.1/24    192.168.88.0    bridge
 1 D 10.0.0.2/30        10.0.0.0        ether1
\`\`\`

- \`D\` means dynamic (assigned by DHCP client)
- \`X\` means disabled

For more detail:

\`\`\`
/ip address print detail
\`\`\`

## Viewing Interface Names

Before assigning an IP, check your interface names:

\`\`\`
/interface print
\`\`\`

Output example:

\`\`\`
 #     NAME      TYPE    ACTUAL-MTU
 0  R  ether1    ether   1500
 1  R  ether2    ether   1500
 2  R  wlan1     wlan    1500
 3  R  bridge    bridge  1500
\`\`\`

## Adding an IP Address

Basic syntax:

\`\`\`
/ip address add address=<IP/PREFIX> interface=<INTERFACE-NAME>
\`\`\`

### Add WAN address (static from ISP)

\`\`\`
/ip address add address=203.0.113.10/30 interface=ether1
\`\`\`

### Add LAN address

\`\`\`
/ip address add address=192.168.1.1/24 interface=ether2
\`\`\`

### Add multiple addresses to one interface

One interface can have multiple IPs:

\`\`\`
/ip address add address=192.168.10.1/24 interface=ether2
/ip address add address=172.16.0.1/24 interface=ether2
\`\`\`

## Modifying an Existing IP Address

Find the entry number with \`print\`, then use \`set\`:

\`\`\`
/ip address print
/ip address set 0 address=192.168.1.1/24
\`\`\`

Or use the \`find\` function:

\`\`\`
/ip address set [find interface=ether2] address=192.168.20.1/24
\`\`\`

## Removing an IP Address

\`\`\`
# Remove by number
/ip address remove 0

# Remove a specific address
/ip address remove [find address=192.168.88.1/24]
\`\`\`

## Disabling and Enabling an IP Address

\`\`\`
/ip address disable 0
/ip address enable 0
\`\`\`

A disabled address shows with the \`X\` flag in \`print\` output.

## Practical Example: Two-Interface Setup

ether1 connected to ISP, ether2 connected to LAN:

\`\`\`
# Static WAN address
/ip address add address=203.0.113.10/30 interface=ether1

# LAN address
/ip address add address=192.168.1.1/24 interface=ether2
\`\`\`

## DHCP Client — Dynamic WAN IP from ISP

If your ISP assigns your WAN IP via DHCP:

\`\`\`
/ip dhcp-client add interface=ether1 disabled=no
\`\`\`

Check the result:

\`\`\`
/ip dhcp-client print
\`\`\`

## Connected Routes Are Created Automatically

When you add an IP address, RouterOS automatically adds a connected route to the routing table. Verify:

\`\`\`
/ip route print
\`\`\`

You will see a route like \`192.168.1.0/24\` via \`ether2\` marked with type \`C\` (connected).

## Common Mistakes to Avoid

### Wrong Subnet Mask

Use \`/30\` for router-to-router links (gives exactly 2 usable hosts). Using \`/24\` wastes 252 addresses.

### Duplicate IP Addresses

Two devices with the same IP on the same subnet causes network chaos. Always check existing addresses before adding new ones.

### Assigning to Wrong Interface

On most MikroTik devices, \`ether1\` is the WAN port and \`ether2\`–\`ether5\` are LAN ports. Double-check before assigning.

### Forgetting to Remove Old Address

Before changing an interface address, remove the old one first to avoid having two addresses on the same interface causing routing confusion.

## Summary

IP addressing in RouterOS is straightforward:

- \`print\` — see current addresses
- \`add address=X.X.X.X/prefix interface=NAME\` — add new address
- \`set NUMBER address=X.X.X.X/prefix\` — modify existing
- \`remove NUMBER\` — delete
- Connected routes are created automatically
`,
    contentFa: `
## آدرس‌دهی IPv4 در RouterOS

قبل از اینکه روتر میکروتیک کار مفیدی انجام دهد، اینترفیس‌ها باید آدرس IP داشته باشند.

## مرور سریع: آدرس IP چیست؟

آدرس IPv4 چهار گروه عدد است که با نقطه از هم جدا می‌شوند — مثلاً \`192.168.1.100\`. **نماد CIDR** نشان می‌دهد چند بیت برای شبکه است:

| CIDR | Subnet Mask | هاست قابل استفاده |
|------|-------------|-----------------|
| /24 | 255.255.255.0 | 254 |
| /25 | 255.255.255.128 | 126 |
| /30 | 255.255.255.252 | 2 |

## مشاهده آدرس‌های IP موجود

\`\`\`
/ip address print
\`\`\`

خروجی نمونه:

\`\`\`
 #   ADDRESS            NETWORK         INTERFACE
 0   192.168.88.1/24    192.168.88.0    bridge
 1 D 10.0.0.2/30        10.0.0.0        ether1
\`\`\`

\`D\` یعنی آدرس از DHCP دریافت شده. \`X\` یعنی غیرفعال است.

## مشاهده نام اینترفیس‌ها

\`\`\`
/interface print
\`\`\`

## اضافه کردن آدرس IP

\`\`\`
/ip address add address=<IP/PREFIX> interface=<INTERFACE-NAME>
\`\`\`

مثال‌ها:

\`\`\`
# آدرس WAN
/ip address add address=203.0.113.10/30 interface=ether1

# آدرس LAN
/ip address add address=192.168.1.1/24 interface=ether2
\`\`\`

## تغییر آدرس موجود

\`\`\`
/ip address print
/ip address set 0 address=192.168.1.1/24
\`\`\`

## حذف آدرس IP

\`\`\`
/ip address remove 0
/ip address remove [find address=192.168.88.1/24]
\`\`\`

## مثال عملی

ether1 به ISP و ether2 به LAN:

\`\`\`
/ip address add address=203.0.113.10/30 interface=ether1
/ip address add address=192.168.1.1/24 interface=ether2
\`\`\`

## DHCP Client — دریافت IP خودکار از ISP

\`\`\`
/ip dhcp-client add interface=ether1 disabled=no
/ip dhcp-client print
\`\`\`

## مسیرهای connected

وقتی آدرس IP اضافه می‌کنید، RouterOS به‌طور خودکار مسیر connected در جدول مسیریابی ایجاد می‌کند:

\`\`\`
/ip route print
\`\`\`

## اشتباهات رایج

- **آدرس اشتباه به اینترفیس اشتباه**: ether1 معمولاً WAN است
- **آدرس تکراری**: دو دستگاه با یک IP باعث اختلال می‌شود
- **فراموش کردن حذف آدرس قدیمی**: قبل از تغییر آدرس، قدیمی را حذف کنید

## جمع‌بندی

- \`print\` برای مشاهده
- \`add\` برای اضافه کردن
- \`set\` برای تغییر
- \`remove\` برای حذف
`,
  },
  'mikrotik-dhcp-server-setup': {
    contentEn: `
## Setting Up a DHCP Server on MikroTik RouterOS

A DHCP server automatically assigns IP addresses to devices on your network. Without it, every device would need a manually configured IP address — which is impractical for most networks. This guide shows you how to set up a complete DHCP server on RouterOS v7.

## How DHCP Works (Brief Overview)

When a device connects to your network, it sends a broadcast message saying "I need an IP address." The DHCP server hears this, picks an available IP from its pool, and sends it to the device along with:

- The assigned IP address
- Subnet mask
- Default gateway (usually your router IP)
- DNS server addresses
- Lease time (how long the device can keep the IP)

## The Three Components of RouterOS DHCP Server

To set up DHCP in RouterOS you need three things:

1. **IP Pool** — the range of addresses to hand out
2. **DHCP Server** — the service that listens for requests and assigns IPs
3. **DHCP Server Network** — tells the DHCP server what gateway and DNS to send to clients

## Step 1: Create an IP Pool

An IP pool defines the range of addresses available for DHCP assignment.

\`\`\`
/ip pool add name=lan-pool ranges=192.168.1.100-192.168.1.200
\`\`\`

This creates a pool named \`lan-pool\` that can hand out addresses from \`.100\` to \`.200\` — that is 101 addresses.

View your pools:

\`\`\`
/ip pool print
\`\`\`

## Step 2: Create the DHCP Server

\`\`\`
/ip dhcp-server add name=dhcp-lan interface=bridge address-pool=lan-pool disabled=no
\`\`\`

Parameters explained:

- \`name=dhcp-lan\` — a name for this DHCP server instance (you can have multiple)
- \`interface=bridge\` — which interface to listen on (use your LAN interface — often a bridge)
- \`address-pool=lan-pool\` — which pool to draw addresses from
- \`disabled=no\` — enable it immediately

View the DHCP server:

\`\`\`
/ip dhcp-server print
\`\`\`

## Step 3: Configure the DHCP Server Network

This tells the DHCP server what network information to send to clients:

\`\`\`
/ip dhcp-server network add address=192.168.1.0/24 gateway=192.168.1.1 dns-server=8.8.8.8,8.8.4.4
\`\`\`

Parameters:

- \`address=192.168.1.0/24\` — the network this DHCP server serves
- \`gateway=192.168.1.1\` — the default gateway clients should use (your router LAN IP)
- \`dns-server=8.8.8.8,8.8.4.4\` — DNS servers for clients

View the network configuration:

\`\`\`
/ip dhcp-server network print
\`\`\`

## Verifying It Works

Connect a device to your LAN and let it get an address automatically. Then check active leases:

\`\`\`
/ip dhcp-server lease print
\`\`\`

You will see something like:

\`\`\`
 #   ADDRESS         MAC-ADDRESS       HOST-NAME    STATUS
 0   192.168.1.100   AA:BB:CC:DD:EE:FF my-laptop    bound
\`\`\`

## Viewing and Managing Leases

### See All Current Leases

\`\`\`
/ip dhcp-server lease print
\`\`\`

### See Detailed Lease Information

\`\`\`
/ip dhcp-server lease print detail
\`\`\`

### Remove a Lease Manually

\`\`\`
/ip dhcp-server lease remove 0
\`\`\`

## Static DHCP Leases

A static DHCP lease (also called a DHCP reservation) assigns the same IP address to a specific device every time, based on its MAC address. This is useful for printers, servers, and other devices that need a predictable IP.

### Adding a Static Lease

\`\`\`
/ip dhcp-server lease add address=192.168.1.50 mac-address=AA:BB:CC:DD:EE:FF server=dhcp-lan comment=my-printer
\`\`\`

Parameters:

- \`address=192.168.1.50\` — the IP to always assign to this device
- \`mac-address=AA:BB:CC:DD:EE:FF\` — the MAC address of the device
- \`server=dhcp-lan\` — which DHCP server this lease belongs to
- \`comment=my-printer\` — optional label for readability

### Converting an Existing Dynamic Lease to Static

If a device already has a dynamic lease and you want to make it permanent:

\`\`\`
/ip dhcp-server lease make-static 0
\`\`\`

(where 0 is the lease number from \`print\`)

This converts the lease to static so that device always gets the same IP.

## Complete DHCP Setup in One Go

Here is a full example for a typical home network where the router LAN interface is a bridge with IP \`192.168.1.1/24\`:

\`\`\`
# Step 1: Create IP pool
/ip pool add name=lan-pool ranges=192.168.1.100-192.168.1.200

# Step 2: Create DHCP server
/ip dhcp-server add name=dhcp-lan interface=bridge address-pool=lan-pool disabled=no

# Step 3: Configure network info for clients
/ip dhcp-server network add address=192.168.1.0/24 gateway=192.168.1.1 dns-server=8.8.8.8,1.1.1.1
\`\`\`

## Lease Time

The default lease time in RouterOS is 10 minutes for the offer and 3 days for the actual lease. You can change it per DHCP server network:

\`\`\`
/ip dhcp-server network set 0 lease-time=1d
\`\`\`

Or set it at the DHCP server level:

\`\`\`
/ip dhcp-server set dhcp-lan lease-time=12h
\`\`\`

Common values: \`30m\`, \`1h\`, \`12h\`, \`1d\`, \`3d\`

## DHCP Server on Multiple Interfaces

If your router has multiple LAN segments, you can run separate DHCP servers for each:

\`\`\`
# Pool for VLAN 10
/ip pool add name=vlan10-pool ranges=10.10.10.100-10.10.10.200

# DHCP server for VLAN 10 interface
/ip dhcp-server add name=dhcp-vlan10 interface=vlan10 address-pool=vlan10-pool disabled=no

# Network info for VLAN 10
/ip dhcp-server network add address=10.10.10.0/24 gateway=10.10.10.1 dns-server=8.8.8.8
\`\`\`

## Using the DHCP Server Setup Wizard

RouterOS also includes a quick setup command that does all three steps automatically:

\`\`\`
/ip dhcp-server setup
\`\`\`

This runs an interactive wizard asking for interface, address pool range, gateway, and DNS. It is the fastest way if you just want a quick setup.

## Summary

DHCP setup in RouterOS requires three steps:

1. Create a pool: \`/ip pool add\`
2. Create the server: \`/ip dhcp-server add\`
3. Configure network info: \`/ip dhcp-server network add\`

Use static leases for devices that need a fixed IP. Use \`/ip dhcp-server lease print\` to monitor what addresses have been assigned.
`,
    contentFa: `
## راه‌اندازی سرور DHCP در میکروتیک RouterOS

سرور DHCP به‌طور خودکار آدرس IP به دستگاه‌های شبکه اختصاص می‌دهد. بدون آن، هر دستگاه باید به‌صورت دستی پیکربندی شود.

## DHCP چطور کار می‌کند؟

وقتی یک دستگاه به شبکه وصل می‌شود، پیامی ارسال می‌کند که می‌گوید آدرس IP می‌خواهم. سرور DHCP یک آدرس از pool خود انتخاب می‌کند و همراه با اطلاعات زیر ارسال می‌کند:

- آدرس IP
- Subnet mask
- Gateway پیش‌فرض
- آدرس سرورهای DNS
- مدت اعتبار (lease time)

## سه مؤلفه DHCP در RouterOS

برای راه‌اندازی DHCP به سه چیز نیاز دارید:

۱. **IP Pool** — محدوده آدرس‌های قابل اختصاص
۲. **DHCP Server** — سرویسی که درخواست‌ها را می‌شنود
۳. **DHCP Server Network** — اطلاعات gateway و DNS برای کلاینت‌ها

## مرحله ۱: ایجاد IP Pool

\`\`\`
/ip pool add name=lan-pool ranges=192.168.1.100-192.168.1.200
\`\`\`

این یک pool ایجاد می‌کند که ۱۰۱ آدرس از \`.100\` تا \`.200\` دارد.

\`\`\`
/ip pool print
\`\`\`

## مرحله ۲: ایجاد DHCP Server

\`\`\`
/ip dhcp-server add name=dhcp-lan interface=bridge address-pool=lan-pool disabled=no
\`\`\`

- \`interface=bridge\` — روی کدام اینترفیس گوش دهد (معمولاً bridge یا ether2)
- \`address-pool=lan-pool\` — از کدام pool آدرس بدهد

\`\`\`
/ip dhcp-server print
\`\`\`

## مرحله ۳: پیکربندی Network DHCP

\`\`\`
/ip dhcp-server network add address=192.168.1.0/24 gateway=192.168.1.1 dns-server=8.8.8.8,8.8.4.4
\`\`\`

- \`address\` — شبکه‌ای که این سرور DHCP سرویس می‌دهد
- \`gateway\` — دروازه پیش‌فرض برای کلاینت‌ها
- \`dns-server\` — سرورهای DNS

## بررسی عملکرد

\`\`\`
/ip dhcp-server lease print
\`\`\`

خروجی نمونه:

\`\`\`
 #   ADDRESS         MAC-ADDRESS       HOST-NAME   STATUS
 0   192.168.1.100   AA:BB:CC:DD:EE:FF my-laptop   bound
\`\`\`

## Static DHCP Lease (رزرو آدرس)

برای دستگاه‌هایی که همیشه باید یک IP ثابت بگیرند (پرینتر، سرور):

\`\`\`
/ip dhcp-server lease add address=192.168.1.50 mac-address=AA:BB:CC:DD:EE:FF server=dhcp-lan comment=my-printer
\`\`\`

### تبدیل lease پویا به ثابت

\`\`\`
/ip dhcp-server lease make-static 0
\`\`\`

## راه‌اندازی کامل (مثال)

\`\`\`
# مرحله ۱: ایجاد pool
/ip pool add name=lan-pool ranges=192.168.1.100-192.168.1.200

# مرحله ۲: ایجاد سرور DHCP
/ip dhcp-server add name=dhcp-lan interface=bridge address-pool=lan-pool disabled=no

# مرحله ۳: اطلاعات شبکه برای کلاینت‌ها
/ip dhcp-server network add address=192.168.1.0/24 gateway=192.168.1.1 dns-server=8.8.8.8,1.1.1.1
\`\`\`

## تنظیم مدت اعتبار (Lease Time)

\`\`\`
/ip dhcp-server set dhcp-lan lease-time=12h
\`\`\`

مقادیر رایج: \`30m\`، \`1h\`، \`12h\`، \`1d\`، \`3d\`

## ویزارد راه‌اندازی سریع

\`\`\`
/ip dhcp-server setup
\`\`\`

این دستور یک ویزارد تعاملی اجرا می‌کند که هر سه مرحله را در یک گام انجام می‌دهد.

## جمع‌بندی

راه‌اندازی DHCP در RouterOS سه مرحله دارد:
۱. \`/ip pool add\` — ایجاد pool آدرس
۲. \`/ip dhcp-server add\` — ایجاد سرور
۳. \`/ip dhcp-server network add\` — پیکربندی اطلاعات شبکه
`,
  },
  'mikrotik-nat-masquerade-basics': {
    contentEn: `
## NAT and Masquerade on MikroTik: Sharing Your Internet Connection

NAT (Network Address Translation) is the technology that allows many devices on your private network to share a single public IP address from your ISP. Without NAT, every device would need its own public IP — which is impractical and expensive. This guide explains how NAT works and how to set it up on RouterOS.

## How NAT Works (The Simple Explanation)

Imagine your home network uses IP addresses like \`192.168.1.x\`. These are private addresses that cannot be routed on the public Internet. Your ISP gives your router a single public IP like \`203.0.113.1\`.

Without NAT, when your laptop (192.168.1.10) tries to visit a website, the website would not know where to send the reply — it cannot reach \`192.168.1.10\` because that address is private.

With NAT (specifically Source NAT, also called masquerade):

1. Your laptop sends a packet from \`192.168.1.10:54321\` to \`93.184.216.34:80\`
2. Your router replaces the source address with its public IP: \`203.0.113.1:54321\`
3. The website replies to \`203.0.113.1:54321\`
4. Your router remembers the original connection and forwards the reply back to \`192.168.1.10:54321\`

The router acts as a translator between your private network and the Internet.

## Source NAT vs Destination NAT

- **Source NAT (SNAT/Masquerade)** — changes the source IP of outgoing packets. Used for Internet sharing.
- **Destination NAT (DNAT/Port Forward)** — changes the destination IP of incoming packets. Used to forward specific ports to internal servers.

This lesson focuses on Source NAT (masquerade).

## Setting Up Masquerade in RouterOS

The command is simple:

\`\`\`
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1 comment=masquerade-for-internet
\`\`\`

Parameters explained:

- \`chain=srcnat\` — this is a Source NAT rule (changes source address)
- \`action=masquerade\` — automatically uses the current IP of the out-interface (perfect when your ISP IP changes dynamically)
- \`out-interface=ether1\` — apply this rule when traffic exits through ether1 (your WAN/Internet interface)
- \`comment=masquerade-for-internet\` — optional label

That single rule is all you need for basic Internet sharing!

## Verifying the NAT Rule

\`\`\`
/ip firewall nat print
\`\`\`

Output example:

\`\`\`
Flags: X - disabled, I - invalid, D - dynamic
 0    chain=srcnat action=masquerade out-interface=ether1
\`\`\`

## Why masquerade Instead of src-nat?

There are two actions that do Source NAT:

- \`action=masquerade\` — automatically uses whatever IP the out-interface currently has. Best when your ISP gives you a dynamic IP (it changes sometimes).
- \`action=src-nat to-addresses=203.0.113.1\` — you specify the exact IP to NAT to. Better for static IP addresses (slightly more efficient).

For most beginners and home setups, use masquerade. It just works.

## Adding More Specificity to the NAT Rule

For better control, you can restrict the masquerade rule to only apply to traffic from your LAN:

\`\`\`
/ip firewall nat add chain=srcnat src-address=192.168.1.0/24 action=masquerade out-interface=ether1
\`\`\`

This only masquerades packets that originated from the \`192.168.1.0/24\` subnet. Traffic from other sources is not affected.

## How to Check If NAT Is Working

After adding the masquerade rule, try pinging the Internet from your MikroTik:

\`\`\`
/ping 8.8.8.8 count=4
\`\`\`

If this works, the router itself has Internet access. Now check from a client device on your LAN — if the client can reach the Internet, NAT is working.

To see NAT connections in real time:

\`\`\`
/ip firewall connection print
\`\`\`

This shows all active connection tracking entries.

## Port Forwarding (Destination NAT) — Brief Overview

If you want to host a server (for example a web server on \`192.168.1.100\` port 80), you need to forward incoming traffic from the WAN to the internal server:

\`\`\`
/ip firewall nat add chain=dstnat in-interface=ether1 protocol=tcp dst-port=80 action=dst-nat to-addresses=192.168.1.100 to-ports=80
\`\`\`

Parameters:

- \`chain=dstnat\` — Destination NAT rule
- \`in-interface=ether1\` — apply when traffic arrives on ether1 (WAN)
- \`protocol=tcp dst-port=80\` — only for TCP port 80 (HTTP)
- \`action=dst-nat to-addresses=192.168.1.100 to-ports=80\` — send it to internal server

## Full Example: Home Network NAT Setup

Assume: ether1 is WAN (DHCP from ISP), ether2 is LAN (\`192.168.1.1/24\`):

\`\`\`
# WAN gets IP from ISP via DHCP
/ip dhcp-client add interface=ether1 disabled=no

# LAN address
/ip address add address=192.168.1.1/24 interface=ether2

# Default route (gets added automatically by DHCP client, but manually:)
# /ip route add dst-address=0.0.0.0/0 gateway=<ISP-GATEWAY>

# Masquerade for Internet sharing
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1
\`\`\`

## Common Mistakes

### Forgetting the Default Route

NAT only handles address translation. Your router still needs to know where to send Internet traffic — you need a default route pointing to your ISP gateway. DHCP client adds this automatically. If using a static IP, add it manually:

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.254
\`\`\`

### Wrong Interface in the NAT Rule

Make sure \`out-interface\` matches your actual WAN interface name. Use \`/interface print\` to confirm.

### NAT Rule Too Broad or Not Broad Enough

If you add \`src-address\` restrictions, make sure they cover all your LAN subnets.

## Summary

Source NAT (masquerade) on MikroTik is set up with one command:

\`\`\`
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1
\`\`\`

This single rule allows all devices on your LAN to share your public IP address and access the Internet. For dynamic ISP IPs, masquerade is the correct action to use.
`,
    contentFa: `
## NAT و Masquerade در میکروتیک: اشتراک‌گذاری اتصال اینترنت

NAT (ترجمه آدرس شبکه) تکنولوژی‌ای است که به چندین دستگاه در شبکه خصوصی شما امکان می‌دهد از یک آدرس IP عمومی استفاده کنند.

## NAT چطور کار می‌کند؟

فرض کنید شبکه خانگی شما از آدرس‌های \`192.168.1.x\` استفاده می‌کند. این آدرس‌های خصوصی در اینترنت عمومی قابل مسیریابی نیستند. ISP شما یک IP عمومی مثل \`203.0.113.1\` به روتر شما می‌دهد.

با NAT (Source NAT یا masquerade):

۱. لپ‌تاپ شما بسته‌ای از \`192.168.1.10:54321\` به سرور ارسال می‌کند
۲. روتر آدرس مبدأ را با IP عمومی جایگزین می‌کند: \`203.0.113.1:54321\`
۳. سرور پاسخ را به \`203.0.113.1:54321\` ارسال می‌کند
۴. روتر پاسخ را به \`192.168.1.10\` هدایت می‌کند

## Source NAT در مقابل Destination NAT

- **Source NAT (Masquerade)** — آدرس مبدأ بسته‌های خروجی را تغییر می‌دهد. برای اشتراک اینترنت.
- **Destination NAT (Port Forward)** — آدرس مقصد بسته‌های ورودی را تغییر می‌دهد. برای هاست کردن سرور.

## راه‌اندازی Masquerade در RouterOS

\`\`\`
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1 comment=masquerade-for-internet
\`\`\`

توضیح پارامترها:

- \`chain=srcnat\` — قانون Source NAT
- \`action=masquerade\` — به‌طور خودکار از IP فعلی اینترفیس خروجی استفاده می‌کند
- \`out-interface=ether1\` — وقتی ترافیک از ether1 (WAN) خارج می‌شود

همین یک دستور برای اشتراک‌گذاری اینترنت کافی است!

## بررسی قانون NAT

\`\`\`
/ip firewall nat print
\`\`\`

## masquerade در مقابل src-nat

- \`action=masquerade\` — وقتی ISP آدرس IP پویا (DHCP) می‌دهد بهتر است
- \`action=src-nat to-addresses=203.0.113.1\` — وقتی IP ثابت دارید کارایی بهتری دارد

برای اکثر مبتدیان از masquerade استفاده کنید.

## اضافه کردن محدودیت به قانون NAT

برای اعمال فقط به ترافیک شبکه LAN:

\`\`\`
/ip firewall nat add chain=srcnat src-address=192.168.1.0/24 action=masquerade out-interface=ether1
\`\`\`

## بررسی عملکرد NAT

\`\`\`
/ping 8.8.8.8 count=4
\`\`\`

اگر این دستور کار کرد، روتر دسترسی به اینترنت دارد. بعد از یک دستگاه کلاینت بررسی کنید.

دیدن اتصالات NAT در لحظه:

\`\`\`
/ip firewall connection print
\`\`\`

## Port Forwarding (Destination NAT)

اگر می‌خواهید سروری داخلی را از بیرون قابل دسترس کنید:

\`\`\`
/ip firewall nat add chain=dstnat in-interface=ether1 protocol=tcp dst-port=80 action=dst-nat to-addresses=192.168.1.100 to-ports=80
\`\`\`

## مثال کامل

\`\`\`
# IP از ISP از طریق DHCP
/ip dhcp-client add interface=ether1 disabled=no

# آدرس LAN
/ip address add address=192.168.1.1/24 interface=ether2

# Masquerade برای اشتراک اینترنت
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1
\`\`\`

## اشتباهات رایج

### فراموش کردن Default Route

NAT فقط آدرس‌ها را ترجمه می‌کند. روتر هنوز باید بداند ترافیک اینترنت را به کجا بفرستد. DHCP client این را خودکار اضافه می‌کند. برای IP ثابت:

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.254
\`\`\`

## جمع‌بندی

Source NAT در میکروتیک با یک دستور راه‌اندازی می‌شود:

\`\`\`
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1
\`\`\`

این یک قانون به همه دستگاه‌های LAN اجازه می‌دهد از IP عمومی شما استفاده کنند.
`,
  },
  'mikrotik-firewall-chains-basics': {
    contentEn: `
## MikroTik Firewall Chains: Understanding input, forward, and output

The firewall is one of the most important features in RouterOS. It lets you control exactly which traffic is allowed through your router and which is blocked. This lesson covers the fundamental concepts: firewall chains, how packets flow through them, and how to write basic rules.

## How Packets Travel Through RouterOS

Before writing firewall rules, you need to understand how RouterOS processes packets. There are three paths a packet can take:

### The input Chain

The \`input\` chain handles packets **destined for the router itself**. Examples:

- Someone trying to SSH into your router (port 22)
- Someone trying to connect to Winbox (port 8291)
- Ping requests to your router IP
- DHCP requests received by the router

Rule of thumb: **input** = traffic going TO the router, not through it.

### The forward Chain

The \`forward\` chain handles packets that **pass through the router** from one interface to another. Examples:

- A device on your LAN browsing the Internet (LAN to WAN)
- Traffic between two VLANs
- Any routed traffic that is not for the router itself

Rule of thumb: **forward** = traffic going THROUGH the router.

### The output Chain

The \`output\` chain handles packets **generated by the router itself**. Examples:

- The router sending a ping (\`/ping 8.8.8.8\`)
- The router sending DNS queries
- RouterOS sending NTP time sync packets

Rule of thumb: **output** = traffic FROM the router. Rarely modified by beginners.

## The Default-Deny Philosophy

A properly secured router uses a **default-deny** approach:

1. Explicitly allow what you want to permit
2. Drop everything else at the end

This is much safer than "allow everything except what you explicitly block."

The classic firewall chain order:

1. Accept established/related traffic (connections already in progress)
2. Drop invalid traffic
3. Accept specific wanted traffic
4. Drop everything else (catch-all drop at the bottom)

## RouterOS Firewall Rule Order

Rules are evaluated **top to bottom**. The first rule that matches a packet wins. This is critical — put more specific rules before more general ones.

\`\`\`
/ip firewall filter print
\`\`\`

Rules are numbered. If rule 0 matches a packet, rules 1, 2, 3 etc. are not checked for that packet.

## Connection Tracking

RouterOS tracks the state of connections using connection tracking. Each packet is classified as:

- \`established\` — part of an already-accepted connection
- \`related\` — related to an established connection (e.g., FTP data channel)
- \`new\` — starting a new connection
- \`invalid\` — does not match any known connection state

This lets you write simple rules like "accept all established traffic" rather than writing rules for both directions of every connection.

## Building a Basic Firewall: input Chain

Here is a safe default configuration for the input chain:

\`\`\`
# Accept established and related connections (traffic from sessions already allowed)
/ip firewall filter add chain=input connection-state=established,related action=accept comment=accept-established-related

# Drop invalid packets
/ip firewall filter add chain=input connection-state=invalid action=drop comment=drop-invalid

# Accept ICMP (ping) from anywhere (optional, remove if you want to be stealthy)
/ip firewall filter add chain=input protocol=icmp action=accept comment=accept-icmp

# Accept management traffic from LAN only
/ip firewall filter add chain=input in-interface=bridge action=accept comment=accept-from-lan

# Drop everything else coming into the router (especially from WAN)
/ip firewall filter add chain=input action=drop comment=drop-all-else
\`\`\`

This configuration:
- Allows all ongoing connections to continue
- Drops bad/invalid packets
- Allows ping
- Allows full management from LAN
- Blocks everything arriving from the WAN (Internet)

## Building a Basic Firewall: forward Chain

\`\`\`
# Accept established and related connections
/ip firewall filter add chain=forward connection-state=established,related action=accept comment=accept-established-related

# Drop invalid packets
/ip firewall filter add chain=forward connection-state=invalid action=drop comment=drop-invalid

# Accept LAN to WAN traffic (allow your clients to reach the Internet)
/ip firewall filter add chain=forward in-interface=bridge out-interface=ether1 action=accept comment=lan-to-wan

# Drop everything else
/ip firewall filter add chain=forward action=drop comment=drop-all-else
\`\`\`

## Viewing Firewall Rules

\`\`\`
/ip firewall filter print
\`\`\`

To see rules with hit counters (how many packets matched each rule):

\`\`\`
/ip firewall filter print stats
\`\`\`

This is very useful for troubleshooting — a rule with zero hits may not be placed correctly.

## Reordering Rules

Rules are applied in order. You can move them with:

\`\`\`
/ip firewall filter move 5 destination=0
\`\`\`

This moves rule 5 to position 0 (the top).

## Disabling and Enabling Rules

Instead of deleting a rule, disable it for testing:

\`\`\`
/ip firewall filter disable 3
/ip firewall filter enable 3
\`\`\`

## Removing Rules

\`\`\`
/ip firewall filter remove 3
\`\`\`

Be careful with the default-deny drop rule at the bottom — removing it might open everything.

## Logging Traffic

To log packets matching a rule (useful for debugging):

\`\`\`
/ip firewall filter add chain=input protocol=tcp dst-port=22 action=log log-prefix=SSH-ATTEMPT
\`\`\`

View logs:

\`\`\`
/log print
\`\`\`

## The address-list Feature

You can group IP addresses into named lists for easier rule management:

\`\`\`
# Create a list
/ip firewall address-list add list=trusted-admins address=192.168.1.10

# Use the list in a rule
/ip firewall filter add chain=input src-address-list=trusted-admins action=accept
\`\`\`

## Summary

Firewall chains in RouterOS:

- **input** — traffic TO the router
- **forward** — traffic THROUGH the router
- **output** — traffic FROM the router

Always use the default-deny pattern: accept what you need, drop everything else at the bottom. Use connection-state matching (established, related, invalid) to simplify your rules. Use \`print stats\` to verify your rules are actually matching traffic.
`,
    contentFa: `
## اصول فایروال در میکروتیک: input، forward و output

فایروال یکی از مهم‌ترین ویژگی‌های RouterOS است. با آن می‌توانید کنترل کنید چه ترافیکی از روتر عبور کند و چه چیزی بلاک شود.

## چطور بسته‌ها در RouterOS پردازش می‌شوند؟

سه مسیر برای یک بسته در RouterOS وجود دارد:

### زنجیره input

\`input\` بسته‌هایی را مدیریت می‌کند که **مقصدشان خود روتر است**:

- اتصال SSH به روتر (پورت ۲۲)
- اتصال Winbox (پورت ۸۲۹۱)
- Ping به آدرس IP روتر
- درخواست‌های DHCP

**قانون:** input = ترافیک که به روتر می‌رود، نه از آن عبور می‌کند.

### زنجیره forward

\`forward\` بسته‌هایی را مدیریت می‌کند که **از روتر عبور می‌کنند**:

- دستگاه‌های LAN که به اینترنت دسترسی دارند
- ترافیک بین VLAN‌ها

**قانون:** forward = ترافیک که از روتر عبور می‌کند.

### زنجیره output

\`output\` بسته‌هایی را مدیریت می‌کند که **خود روتر ایجاد می‌کند**:

- روتر Ping ارسال می‌کند
- روتر DNS query ارسال می‌کند

**قانون:** output = ترافیک از روتر. مبتدیان معمولاً آن را تغییر نمی‌دهند.

## فلسفه default-deny

یک روتر امن از رویکرد **default-deny** استفاده می‌کند:

۱. آنچه می‌خواهید مجاز باشد را صریحاً مجاز کنید
۲. در پایان همه چیز دیگر را drop کنید

## Connection Tracking

RouterOS وضعیت اتصالات را ردیابی می‌کند. هر بسته به یکی از این حالت‌ها تعلق دارد:

- \`established\` — بخشی از اتصال موجود
- \`related\` — مرتبط با اتصال موجود
- \`new\` — شروع اتصال جدید
- \`invalid\` — با هیچ حالت شناخته‌شده‌ای مطابقت ندارد

## ساخت فایروال پایه: زنجیره input

\`\`\`
# پذیرش اتصالات موجود
/ip firewall filter add chain=input connection-state=established,related action=accept comment=accept-established-related

# Drop بسته‌های نامعتبر
/ip firewall filter add chain=input connection-state=invalid action=drop comment=drop-invalid

# پذیرش ICMP (ping)
/ip firewall filter add chain=input protocol=icmp action=accept comment=accept-icmp

# پذیرش ترافیک مدیریتی از LAN
/ip firewall filter add chain=input in-interface=bridge action=accept comment=accept-from-lan

# Drop همه چیز دیگر
/ip firewall filter add chain=input action=drop comment=drop-all-else
\`\`\`

## ساخت فایروال پایه: زنجیره forward

\`\`\`
# پذیرش اتصالات موجود
/ip firewall filter add chain=forward connection-state=established,related action=accept comment=accept-established-related

# Drop بسته‌های نامعتبر
/ip firewall filter add chain=forward connection-state=invalid action=drop comment=drop-invalid

# پذیرش ترافیک از LAN به WAN
/ip firewall filter add chain=forward in-interface=bridge out-interface=ether1 action=accept comment=lan-to-wan

# Drop همه چیز دیگر
/ip firewall filter add chain=forward action=drop comment=drop-all-else
\`\`\`

## مشاهده قوانین فایروال

\`\`\`
/ip firewall filter print
\`\`\`

با شمارنده hits:

\`\`\`
/ip firewall filter print stats
\`\`\`

## مدیریت قوانین

\`\`\`
# جابجایی قانون
/ip firewall filter move 5 destination=0

# غیرفعال کردن موقت
/ip firewall filter disable 3
/ip firewall filter enable 3

# حذف
/ip firewall filter remove 3
\`\`\`

## ثبت گزارش ترافیک

\`\`\`
/ip firewall filter add chain=input protocol=tcp dst-port=22 action=log log-prefix=SSH-ATTEMPT
/log print
\`\`\`

## جمع‌بندی

زنجیره‌های فایروال در RouterOS:

- **input** — ترافیک به روتر
- **forward** — ترافیک از روتر عبور می‌کند
- **output** — ترافیک از روتر

همیشه از الگوی default-deny استفاده کنید: آنچه نیاز دارید را مجاز کنید، بقیه را در پایان drop کنید.
`,
  },
  'mikrotik-static-routing-basics': {
    contentEn: `
## Static Routing on MikroTik RouterOS

Routing is the process of deciding where to send a packet based on its destination IP address. RouterOS maintains a **routing table** — a list of known networks and how to reach them. This lesson covers static routes: routes you add manually.

## The Routing Table

To see the current routing table:

\`\`\`
/ip route print
\`\`\`

Example output:

\`\`\`
Flags: X - disabled, A - active, D - dynamic, C - connect, S - static, r - rip, b - bgp, o - ospf
 #      DST-ADDRESS        PREF-SRC        GATEWAY            DISTANCE
 0 ADC  192.168.1.0/24     192.168.1.1     bridge             0
 1 ADC  10.0.0.0/30        10.0.0.1        ether1             0
 2 ADS  0.0.0.0/0                          10.0.0.254         1
\`\`\`

Understanding the flags:

- \`A\` — Active (this route is currently being used)
- \`D\` — Dynamic (added automatically, e.g., by DHCP client or routing protocol)
- \`C\` — Connected (created automatically when you add an IP address to an interface)
- \`S\` — Static (manually added by you)

## The Default Route

The most important static route is the **default route** — also called the gateway of last resort. It tells the router where to send traffic when no more specific route exists (which is most Internet traffic).

The default route has destination \`0.0.0.0/0\`, which matches every IP address (with the lowest priority — more specific routes always win).

### Adding a Default Route

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254
\`\`\`

Here \`10.0.0.254\` is your ISP gateway address. Every packet destined for the Internet will be sent there.

### Check Your Default Route

\`\`\`
/ip route print where dst-address=0.0.0.0/0
\`\`\`

## Adding Static Routes

The general syntax is:

\`\`\`
/ip route add dst-address=<NETWORK/PREFIX> gateway=<NEXT-HOP-IP>
\`\`\`

### Example: Route to a Remote Network

Suppose you have two offices connected via a VPN or leased line:

- Your office: \`192.168.1.0/24\`
- Remote office: \`192.168.2.0/24\`
- The gateway to reach the remote office: \`10.10.10.2\`

\`\`\`
/ip route add dst-address=192.168.2.0/24 gateway=10.10.10.2 comment=route-to-remote-office
\`\`\`

Now packets going to \`192.168.2.x\` will be sent to \`10.10.10.2\`, which forwards them to the remote office.

### Example: Multiple Hops

If you need to reach \`172.16.0.0/16\` through \`192.168.1.254\`:

\`\`\`
/ip route add dst-address=172.16.0.0/16 gateway=192.168.1.254
\`\`\`

## Route Distance (Metric)

Every route has a **distance** value (also called administrative distance or metric). Lower distance = higher priority.

Default distances:

| Route Type | Default Distance |
|------------|-----------------|
| Connected | 0 |
| Static | 1 |
| eBGP | 20 |
| OSPF | 110 |
| RIP | 120 |

You can set the distance when adding a route:

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254 distance=1
\`\`\`

### Using Distance for Backup Routes (Floating Static Routes)

You can add two routes to the same destination with different distances to create a primary/backup setup:

\`\`\`
# Primary route (distance 1 — used first)
/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254 distance=1

# Backup route (distance 5 — only used if primary is inactive)
/ip route add dst-address=0.0.0.0/0 gateway=192.168.100.1 distance=5
\`\`\`

RouterOS will always use the route with lower distance when both are active. If the primary gateway fails (and RouterOS detects this via the check-gateway feature), it automatically switches to the backup.

## The check-gateway Feature

RouterOS can monitor whether a gateway is reachable and mark a route as inactive if it is not:

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254 check-gateway=ping
\`\`\`

With \`check-gateway=ping\`, RouterOS periodically pings the gateway. If it stops responding, the route is marked inactive and the next-best route takes over.

## Longest Prefix Match

When a packet arrives, RouterOS picks the most specific route (the longest prefix) that matches. For example:

- Route A: \`10.0.0.0/8\` via gateway1
- Route B: \`10.10.0.0/16\` via gateway2
- Route C: \`10.10.10.0/24\` via gateway3

A packet going to \`10.10.10.5\` will use Route C (most specific, longest prefix \`/24\`).
A packet going to \`10.10.5.5\` will use Route B.
A packet going to \`10.20.0.5\` will use Route A.

## Removing and Modifying Static Routes

Remove a route by number:

\`\`\`
/ip route remove 2
\`\`\`

Remove a specific route:

\`\`\`
/ip route remove [find dst-address=192.168.2.0/24]
\`\`\`

Modify a route:

\`\`\`
/ip route set 2 gateway=10.10.10.3
\`\`\`

## Disabling Routes

You can disable a route without removing it (useful for testing):

\`\`\`
/ip route disable 2
/ip route enable 2
\`\`\`

A disabled route shows with \`X\` flag in \`print\`.

## Testing Routing with ping and traceroute

Test if a destination is reachable:

\`\`\`
/ping 192.168.2.1 count=4
\`\`\`

Trace the path packets take:

\`\`\`
/tool traceroute 8.8.8.8
\`\`\`

This shows every hop along the path to the destination — very useful for diagnosing routing problems.

## Viewing the Route Table With Filters

Show only static routes:

\`\`\`
/ip route print where static
\`\`\`

Show only active routes:

\`\`\`
/ip route print where active
\`\`\`

## Summary

Static routing in RouterOS:

- View routes: \`/ip route print\`
- Add default route: \`/ip route add dst-address=0.0.0.0/0 gateway=X.X.X.X\`
- Add specific route: \`/ip route add dst-address=NETWORK/PREFIX gateway=X.X.X.X\`
- Lower distance = higher priority
- Use floating static routes (different distances) for backup paths
- Use \`check-gateway=ping\` to automatically failover when a gateway goes down
`,
    contentFa: `
## مسیریابی ایستا در RouterOS میکروتیک

مسیریابی فرآیندی است که تعیین می‌کند یک بسته به کجا ارسال شود. RouterOS یک **جدول مسیریابی** نگه می‌دارد — لیستی از شبکه‌های شناخته‌شده و نحوه دسترسی به آنها.

## جدول مسیریابی

\`\`\`
/ip route print
\`\`\`

خروجی نمونه:

\`\`\`
 #      DST-ADDRESS        GATEWAY         DISTANCE
 0 ADC  192.168.1.0/24     bridge          0
 1 ADC  10.0.0.0/30        ether1          0
 2 ADS  0.0.0.0/0          10.0.0.254      1
\`\`\`

درک پرچم‌ها:

- \`A\` — فعال
- \`D\` — پویا (خودکار اضافه شده)
- \`C\` — Connected (وقتی IP اضافه می‌کنید خودکار ایجاد می‌شود)
- \`S\` — Static (دستی اضافه شده)

## مسیر پیش‌فرض (Default Route)

مهم‌ترین مسیر ایستا، **مسیر پیش‌فرض** است. به روتر می‌گوید ترافیکی که مسیر مشخصی ندارد را کجا بفرستد.

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254
\`\`\`

\`10.0.0.254\` آدرس gateway ISP شماست.

## اضافه کردن مسیر ایستا

\`\`\`
/ip route add dst-address=<NETWORK/PREFIX> gateway=<NEXT-HOP-IP>
\`\`\`

### مثال: مسیر به شبکه راه دور

فرض کنید دو دفتر دارید:
- دفتر شما: \`192.168.1.0/24\`
- دفتر راه دور: \`192.168.2.0/24\`
- Gateway برای رسیدن به دفتر راه دور: \`10.10.10.2\`

\`\`\`
/ip route add dst-address=192.168.2.0/24 gateway=10.10.10.2 comment=route-to-remote-office
\`\`\`

## Distance (فاصله / متریک)

هر مسیر یک مقدار **distance** دارد. Distance کمتر = اولویت بیشتر.

| نوع مسیر | Distance پیش‌فرض |
|----------|----------------|
| Connected | 0 |
| Static | 1 |
| OSPF | 110 |
| RIP | 120 |

### مسیر پشتیبان (Floating Static Route)

دو مسیر به یک مقصد با distance متفاوت:

\`\`\`
# مسیر اصلی (distance 1 — اول استفاده می‌شود)
/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254 distance=1

# مسیر پشتیبان (distance 5 — فقط وقتی مسیر اصلی کار نمی‌کند)
/ip route add dst-address=0.0.0.0/0 gateway=192.168.100.1 distance=5
\`\`\`

## check-gateway — نظارت بر gateway

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254 check-gateway=ping
\`\`\`

با این تنظیم، RouterOS به‌طور دوره‌ای gateway را ping می‌کند. اگر پاسخ ندهد، مسیر غیرفعال می‌شود و مسیر پشتیبان فعال می‌گردد.

## Longest Prefix Match

RouterOS مشخص‌ترین مسیر را انتخاب می‌کند. اگر سه مسیر دارید:

- \`10.0.0.0/8\` از gateway1
- \`10.10.0.0/16\` از gateway2
- \`10.10.10.0/24\` از gateway3

بسته‌ای به \`10.10.10.5\` از مسیر سوم (طولانی‌ترین پیشوند) استفاده می‌کند.

## حذف و تغییر مسیرها

\`\`\`
# حذف با شماره
/ip route remove 2

# حذف مسیر خاص
/ip route remove [find dst-address=192.168.2.0/24]

# تغییر gateway
/ip route set 2 gateway=10.10.10.3
\`\`\`

## تست مسیریابی

\`\`\`
# پینگ
/ping 192.168.2.1 count=4

# مسیریابی را trace کنید
/tool traceroute 8.8.8.8
\`\`\`

## جمع‌بندی

مسیریابی ایستا در RouterOS:

- \`print\` برای مشاهده جدول مسیریابی
- \`add dst-address=0.0.0.0/0 gateway=X.X.X.X\` برای مسیر پیش‌فرض
- \`add dst-address=NETWORK/PREFIX gateway=X.X.X.X\` برای مسیر خاص
- Distance کمتر = اولویت بیشتر
- از \`check-gateway=ping\` برای failover خودکار استفاده کنید
`,
  },
  'mikrotik-wireless-ap-setup': {
    contentEn: `
## Setting Up a Wireless Access Point on MikroTik RouterOS

MikroTik devices with built-in wireless (like the hAP ac series) can act as a Wi-Fi access point. This lesson covers how to configure basic wireless on RouterOS v7, including SSID, security (WPA2), frequency selection, and connecting to a bridge.

## Checking Available Wireless Interfaces

First, see what wireless interfaces are available:

\`\`\`
/interface wireless print
\`\`\`

Output example on an hAP ac2:

\`\`\`
 #    NAME      TYPE       ACTUAL-MTU  L2MTU  MAX-L2MTU  MAC-ADDRESS
 0    wlan1     wlan       1500        1600   2290       AA:BB:CC:DD:EE:01
 1    wlan2     wlan       1500        1600   2290       AA:BB:CC:DD:EE:02
\`\`\`

- \`wlan1\` is usually the 2.4 GHz radio
- \`wlan2\` is usually the 5 GHz radio

## Understanding Wireless Modes

RouterOS wireless interfaces can operate in different modes:

- \`ap-bridge\` — Access Point mode (allows multiple clients to connect) — **this is what you want for a standard AP**
- \`station\` — Client mode (connects to another AP, like a Wi-Fi adapter)
- \`bridge\` — Point-to-point bridge mode
- \`station-bridge\` — Client mode with bridging support

For a standard access point, use \`ap-bridge\`.

## Step 1: Create a Security Profile (WPA2)

Before configuring the wireless interface, create a security profile with your Wi-Fi password:

\`\`\`
/interface wireless security-profiles add name=my-wpa2 authentication-types=wpa2-psk mode=dynamic-keys wpa2-pre-shared-key=MySecurePassword123
\`\`\`

Parameters:

- \`name=my-wpa2\` — name for this profile
- \`authentication-types=wpa2-psk\` — WPA2 with Pre-Shared Key (standard home/office Wi-Fi)
- \`mode=dynamic-keys\` — required for WPA2
- \`wpa2-pre-shared-key=MySecurePassword123\` — your Wi-Fi password (8 to 63 characters)

View security profiles:

\`\`\`
/interface wireless security-profiles print
\`\`\`

## Step 2: Configure the Wireless Interface

Now configure the wireless interface to use AP mode with your settings:

\`\`\`
/interface wireless set wlan1 mode=ap-bridge ssid=MyNetwork band=2ghz-b/g/n channel-width=20/40mhz-XX frequency=auto security-profile=my-wpa2 disabled=no
\`\`\`

Parameters explained:

- \`mode=ap-bridge\` — Access Point mode (allow multiple clients)
- \`ssid=MyNetwork\` — your Wi-Fi network name (visible to devices)
- \`band=2ghz-b/g/n\` — support 802.11b, g, and n clients (most compatible)
- \`channel-width=20/40mhz-XX\` — allow 20 or 40 MHz channel width (40 MHz gives better speed)
- \`frequency=auto\` — let RouterOS pick the best channel automatically
- \`security-profile=my-wpa2\` — use the profile you created
- \`disabled=no\` — enable the interface

For the 5 GHz radio (wlan2):

\`\`\`
/interface wireless set wlan2 mode=ap-bridge ssid=MyNetwork-5G band=5ghz-a/n/ac channel-width=20/40/80mhz-XXXX frequency=auto security-profile=my-wpa2 disabled=no
\`\`\`

## Step 3: Add the Wireless Interface to a Bridge

For your Wi-Fi clients to communicate with your wired LAN clients (and share the same subnet), add the wireless interface to the same bridge as your LAN ports:

\`\`\`
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge
\`\`\`

Now wired devices on ether2–ether5 and wireless devices on wlan1/wlan2 are all on the same Layer 2 network and will get IPs from the same DHCP server.

## Verifying the Wireless Interface

Check the interface status:

\`\`\`
/interface wireless print
\`\`\`

Check connected clients:

\`\`\`
/interface wireless registration-table print
\`\`\`

This shows all devices currently connected to your access point, including their MAC address, signal strength (dBm), and TX/RX rates.

## Frequency and Channel Selection

### 2.4 GHz Channels

The 2.4 GHz band has 11–14 channels (depending on country), but only channels **1, 6, and 11** are non-overlapping in a 20 MHz width. Using auto frequency lets RouterOS scan and pick the least congested channel.

To manually set a specific channel:

\`\`\`
/interface wireless set wlan1 frequency=2412
\`\`\`

Common 2.4 GHz frequencies:
- Channel 1: 2412 MHz
- Channel 6: 2437 MHz
- Channel 11: 2462 MHz

### 5 GHz Channels

The 5 GHz band has many more non-overlapping channels and is generally less congested. Frequencies range from 5180 MHz to 5825 MHz. Use \`frequency=auto\` to let RouterOS pick.

## Country Setting (Important for Legal Compliance)

Set your country to ensure RouterOS only uses frequencies legal in your country:

\`\`\`
/interface wireless set wlan1 country=iran
/interface wireless set wlan2 country=iran
\`\`\`

Available countries:

\`\`\`
/interface wireless info country-info print
\`\`\`

## Hiding the SSID

If you want to hide your network name (not broadcast it):

\`\`\`
/interface wireless set wlan1 hide-ssid=yes
\`\`\`

Note: hiding the SSID provides very little security — determined users can still find it. A strong password is much more important.

## Full Example: Dual-Band Access Point Setup

\`\`\`
# Create security profile
/interface wireless security-profiles add name=home-wifi authentication-types=wpa2-psk mode=dynamic-keys wpa2-pre-shared-key=SuperSecret99

# Set country
/interface wireless set wlan1 country=united-states
/interface wireless set wlan2 country=united-states

# Configure 2.4 GHz AP
/interface wireless set wlan1 mode=ap-bridge ssid=HomeNet band=2ghz-b/g/n frequency=auto security-profile=home-wifi disabled=no

# Configure 5 GHz AP
/interface wireless set wlan2 mode=ap-bridge ssid=HomeNet-5G band=5ghz-a/n/ac frequency=auto security-profile=home-wifi disabled=no

# Add both to bridge
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge
\`\`\`

## Summary

Setting up a basic wireless AP on MikroTik:

1. Create a security profile (WPA2 password): \`/interface wireless security-profiles add\`
2. Configure the wireless interface: \`/interface wireless set wlan1 mode=ap-bridge ssid=...\`
3. Add to bridge: \`/interface bridge port add interface=wlan1 bridge=bridge\`

Use \`registration-table print\` to see connected clients and their signal strength.
`,
    contentFa: `
## راه‌اندازی اکسس‌پوینت وایرلس در میکروتیک RouterOS

دستگاه‌های میکروتیک با رادیو وایرلس داخلی (مثل سری hAP ac) می‌توانند به‌عنوان اکسس‌پوینت Wi-Fi عمل کنند.

## بررسی اینترفیس‌های وایرلس

\`\`\`
/interface wireless print
\`\`\`

خروجی در hAP ac2:

\`\`\`
 #    NAME   TYPE   MAC-ADDRESS
 0    wlan1  wlan   AA:BB:CC:DD:EE:01
 1    wlan2  wlan   AA:BB:CC:DD:EE:02
\`\`\`

- \`wlan1\` معمولاً رادیو ۲.۴ گیگاهرتز
- \`wlan2\` معمولاً رادیو ۵ گیگاهرتز

## حالت‌های وایرلس

- \`ap-bridge\` — حالت اکسس‌پوینت (چند کلاینت می‌تواند متصل شود) — **برای AP استاندارد**
- \`station\` — حالت کلاینت (مثل آداپتور Wi-Fi)
- \`station-bridge\` — حالت کلاینت با پشتیبانی bridging

## مرحله ۱: ایجاد پروفایل امنیتی (WPA2)

\`\`\`
/interface wireless security-profiles add name=my-wpa2 authentication-types=wpa2-psk mode=dynamic-keys wpa2-pre-shared-key=MySecurePassword123
\`\`\`

- \`name=my-wpa2\` — نام پروفایل
- \`authentication-types=wpa2-psk\` — WPA2 با Pre-Shared Key
- \`wpa2-pre-shared-key\` — رمز Wi-Fi (۸ تا ۶۳ کاراکتر)

## مرحله ۲: پیکربندی اینترفیس وایرلس

\`\`\`
/interface wireless set wlan1 mode=ap-bridge ssid=MyNetwork band=2ghz-b/g/n channel-width=20/40mhz-XX frequency=auto security-profile=my-wpa2 disabled=no
\`\`\`

- \`mode=ap-bridge\` — حالت اکسس‌پوینت
- \`ssid=MyNetwork\` — نام شبکه Wi-Fi
- \`band=2ghz-b/g/n\` — پشتیبانی از 802.11b/g/n
- \`frequency=auto\` — انتخاب خودکار بهترین کانال

برای رادیو ۵ گیگاهرتز:

\`\`\`
/interface wireless set wlan2 mode=ap-bridge ssid=MyNetwork-5G band=5ghz-a/n/ac channel-width=20/40/80mhz-XXXX frequency=auto security-profile=my-wpa2 disabled=no
\`\`\`

## مرحله ۳: اضافه کردن به Bridge

برای اینکه کلاینت‌های وایرلس با شبکه سیمی در یک subnet باشند:

\`\`\`
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge
\`\`\`

## بررسی کلاینت‌های متصل

\`\`\`
/interface wireless registration-table print
\`\`\`

این دستور همه دستگاه‌های متصل به AP را نشان می‌دهد، از جمله آدرس MAC و قدرت سیگنال.

## انتخاب فرکانس و کانال

### باند ۲.۴ گیگاهرتز

فقط کانال‌های **۱، ۶ و ۱۱** در عرض ۲۰ مگاهرتز با هم تداخل ندارند. استفاده از \`frequency=auto\` توصیه می‌شود.

\`\`\`
/interface wireless set wlan1 frequency=2412   # کانال 1
\`\`\`

### باند ۵ گیگاهرتز

باند ۵ گیگاهرتز کانال‌های بیشتری دارد و معمولاً شلوغ‌تری کمتری دارد.

## تنظیم کشور (مهم برای انطباق قانونی)

\`\`\`
/interface wireless set wlan1 country=iran
/interface wireless set wlan2 country=iran
\`\`\`

## مثال کامل: راه‌اندازی AP دوباند

\`\`\`
# ایجاد پروفایل امنیتی
/interface wireless security-profiles add name=home-wifi authentication-types=wpa2-psk mode=dynamic-keys wpa2-pre-shared-key=SuperSecret99

# تنظیم ۲.۴ گیگاهرتز
/interface wireless set wlan1 mode=ap-bridge ssid=HomeNet band=2ghz-b/g/n frequency=auto security-profile=home-wifi disabled=no

# تنظیم ۵ گیگاهرتز
/interface wireless set wlan2 mode=ap-bridge ssid=HomeNet-5G band=5ghz-a/n/ac frequency=auto security-profile=home-wifi disabled=no

# اضافه کردن به bridge
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge
\`\`\`

## جمع‌بندی

راه‌اندازی AP وایرلس در میکروتیک:

۱. ایجاد پروفایل امنیتی WPA2
۲. پیکربندی اینترفیس وایرلس با SSID و security-profile
۳. اضافه کردن اینترفیس به bridge

از \`registration-table print\` برای مشاهده کلاینت‌های متصل استفاده کنید.
`,
  },
  'mikrotik-bridge-configuration': {
    contentEn: `
## Bridging in MikroTik RouterOS: Connecting Multiple Ethernet Ports

A bridge in networking is a virtual switch that connects multiple interfaces at Layer 2 (the Ethernet/MAC layer). When ports are bridged together, devices connected to any of those ports can communicate directly as if they were all on the same physical switch. This lesson explains when to use bridging, how to create and configure a bridge in RouterOS, and when to use routing instead.

## Bridging vs Routing: When to Use Which?

Understanding the difference is fundamental:

### Bridging (Layer 2)
- Devices on bridged ports are in the **same subnet** (e.g., all \`192.168.1.x\`)
- Traffic between devices on bridged ports does not go through the RouterOS routing engine
- The bridge acts like a switch — fast, transparent forwarding based on MAC addresses
- Use bridging when you want all ports to act as one LAN

### Routing (Layer 3)
- Devices on different interfaces are in **different subnets** (e.g., \`192.168.1.x\` and \`10.0.0.x\`)
- Traffic between subnets is processed by the RouterOS routing engine
- Gives you full firewall control and visibility over inter-subnet traffic
- Use routing when you need to separate traffic (VLANs, security zones, etc.)

**Simple rule:** Same subnet = bridge. Different subnets = route.

## Creating a Bridge Interface

In RouterOS v7, creating a bridge is a three-step process:

1. Create the bridge interface
2. Add member ports to the bridge
3. Assign an IP address to the bridge (not to the individual member ports)

### Step 1: Create the Bridge

\`\`\`
/interface bridge add name=bridge comment=lan-bridge
\`\`\`

You can name it anything. \`bridge\` is the common convention for the main LAN bridge.

View the bridge:

\`\`\`
/interface bridge print
\`\`\`

### Step 2: Add Ports to the Bridge

Add whichever Ethernet ports you want in the LAN:

\`\`\`
/interface bridge port add interface=ether2 bridge=bridge
/interface bridge port add interface=ether3 bridge=bridge
/interface bridge port add interface=ether4 bridge=bridge
/interface bridge port add interface=ether5 bridge=bridge
\`\`\`

Notice that ether1 is NOT added — it is kept separate as the WAN port.

View bridge ports:

\`\`\`
/interface bridge port print
\`\`\`

Output example:

\`\`\`
Flags: X - disabled, I - inactive, D - dynamic, H - hw-offload
 #     INTERFACE  BRIDGE   HW   PVID  PRIORITY   PATH-COST   HORIZON
 0   H ether2     bridge   yes  1     0x80       10          none
 1   H ether3     bridge   yes  1     0x80       10          none
 2   H ether4     bridge   yes  1     0x80       10          none
 3   H ether5     bridge   yes  1     0x80       10          none
\`\`\`

The \`H\` flag means hardware offload is active — the CRS switch chip handles bridging in hardware for maximum performance.

### Step 3: Assign an IP to the Bridge Interface

Instead of assigning IPs to ether2, ether3 etc. individually, assign one IP to the bridge:

\`\`\`
/ip address add address=192.168.1.1/24 interface=bridge
\`\`\`

This single IP serves as the gateway for all devices connected to any bridged port.

## Adding Wireless to the Bridge

To include wireless clients in the same LAN as wired clients:

\`\`\`
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge
\`\`\`

Now wired (ether2–ether5) and wireless (wlan1, wlan2) devices are all in the same bridge and share the same subnet and DHCP server.

## Hardware Offload

On MikroTik devices with a built-in switch chip (most RouterBOARD devices), bridging can be offloaded to the hardware switch chip for much higher throughput than software bridging.

RouterOS enables hardware offload automatically when it can. You can check the status with:

\`\`\`
/interface bridge port print
\`\`\`

Look for the \`H\` flag in the output — if present, hardware offload is active.

To explicitly enable or disable hardware offload on a port:

\`\`\`
/interface bridge port set 0 hw=yes
\`\`\`

## Bridge MAC Address and STP

### MAC Address

When you create a bridge, RouterOS assigns it a MAC address (usually borrowed from the first port added). You can set it manually:

\`\`\`
/interface bridge set bridge auto-mac=no admin-mac=AA:BB:CC:DD:EE:01
\`\`\`

### Spanning Tree Protocol (STP)

STP prevents bridging loops (which would crash your network). RouterOS supports:

- \`none\` — no STP (use only when you have no loops possible)
- \`stp\` — classic Spanning Tree Protocol
- \`rstp\` — Rapid STP (faster convergence, recommended)

Set STP mode:

\`\`\`
/interface bridge set bridge protocol-mode=rstp
\`\`\`

For a simple home/office setup with no redundant links, \`none\` works fine. For networks with multiple uplinks, use \`rstp\`.

## VLAN-Aware Bridging (Brief Overview)

RouterOS v7 bridges support VLAN filtering, which lets you run multiple VLANs on the same physical ports while still using hardware offload. This is a more advanced topic but worth knowing exists:

\`\`\`
/interface bridge set bridge vlan-filtering=yes
\`\`\`

When VLAN filtering is enabled, you configure VLAN membership per port using \`/interface bridge vlan\`.

## Complete Example: 5-Port Home Router Bridge Setup

Here is a typical configuration where ether1 is WAN and ether2–ether5 are LAN:

\`\`\`
# Create bridge
/interface bridge add name=bridge protocol-mode=rstp

# Add LAN ports to bridge
/interface bridge port add interface=ether2 bridge=bridge hw=yes
/interface bridge port add interface=ether3 bridge=bridge hw=yes
/interface bridge port add interface=ether4 bridge=bridge hw=yes
/interface bridge port add interface=ether5 bridge=bridge hw=yes

# Add wireless to bridge (if device has wireless)
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge

# Assign IP to the bridge
/ip address add address=192.168.1.1/24 interface=bridge

# Set up DHCP server on bridge
/ip pool add name=lan-pool ranges=192.168.1.100-192.168.1.200
/ip dhcp-server add name=dhcp-lan interface=bridge address-pool=lan-pool disabled=no
/ip dhcp-server network add address=192.168.1.0/24 gateway=192.168.1.1 dns-server=8.8.8.8
\`\`\`

## Troubleshooting Bridges

### Check Which Ports Are in the Bridge

\`\`\`
/interface bridge port print
\`\`\`

### Check the Bridge MAC Table (ARP-like Layer 2 Table)

\`\`\`
/interface bridge host print
\`\`\`

This shows which MAC addresses have been learned on which bridge port.

### Check Bridge Status

\`\`\`
/interface bridge print detail
\`\`\`

## Summary

Bridging in RouterOS:

- Use when you want multiple ports on the same subnet (acting as a switch)
- Create bridge: \`/interface bridge add name=bridge\`
- Add ports: \`/interface bridge port add interface=etherX bridge=bridge\`
- Assign one IP to the bridge, not to individual ports
- Enable hardware offload (\`hw=yes\`) for maximum performance
- Use RSTP (\`protocol-mode=rstp\`) to prevent bridging loops
- Bridge vs route: same subnet = bridge, different subnets = route
`,
    contentFa: `
## پیکربندی Bridge در میکروتیک RouterOS

Bridge در شبکه یک سوئیچ مجازی است که چند اینترفیس را در سطح لایه ۲ (اترنت/MAC) به هم متصل می‌کند. وقتی پورت‌ها bridge می‌شوند، دستگاه‌های متصل به هر پورت می‌توانند مستقیم با هم ارتباط برقرار کنند.

## Bridge در مقابل Routing: کدام را انتخاب کنیم؟

### Bridging (لایه ۲)
- دستگاه‌ها در **یک subnet** هستند (مثلاً همه \`192.168.1.x\`)
- ترافیک بین دستگاه‌های bridge شده از موتور مسیریابی RouterOS نمی‌گذرد
- Bridge مثل سوئیچ عمل می‌کند — سریع و شفاف بر اساس آدرس MAC
- **استفاده:** وقتی می‌خواهید همه پورت‌ها یک LAN باشند

### Routing (لایه ۳)
- دستگاه‌ها در **subnet‌های مختلف** هستند
- ترافیک بین subnet‌ها از موتور مسیریابی می‌گذرد
- کنترل کامل فایروال بر ترافیک بین subnet‌ها
- **استفاده:** وقتی باید ترافیک را جدا کنید (VLAN، zone امنیتی)

**قانون ساده:** یک subnet = bridge. چند subnet = route.

## ایجاد Bridge

### مرحله ۱: ایجاد اینترفیس Bridge

\`\`\`
/interface bridge add name=bridge comment=lan-bridge
\`\`\`

مشاهده:

\`\`\`
/interface bridge print
\`\`\`

### مرحله ۲: اضافه کردن پورت‌ها به Bridge

\`\`\`
/interface bridge port add interface=ether2 bridge=bridge
/interface bridge port add interface=ether3 bridge=bridge
/interface bridge port add interface=ether4 bridge=bridge
/interface bridge port add interface=ether5 bridge=bridge
\`\`\`

توجه: ether1 اضافه نمی‌شود — به‌عنوان پورت WAN جداگانه باقی می‌ماند.

مشاهده پورت‌های bridge:

\`\`\`
/interface bridge port print
\`\`\`

### مرحله ۳: تخصیص IP به Bridge

به‌جای تخصیص IP به هر پورت، یک IP به bridge می‌دهیم:

\`\`\`
/ip address add address=192.168.1.1/24 interface=bridge
\`\`\`

## اضافه کردن وایرلس به Bridge

برای اینکه کلاینت‌های وایرلس در همان شبکه کلاینت‌های سیمی باشند:

\`\`\`
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge
\`\`\`

## Hardware Offload

روی دستگاه‌های میکروتیک با تراشه سوئیچ داخلی، bridge می‌تواند به سخت‌افزار واگذار شود:

پرچم \`H\` در خروجی \`port print\` نشان می‌دهد hardware offload فعال است.

\`\`\`
/interface bridge port set 0 hw=yes
\`\`\`

## Spanning Tree Protocol (STP)

STP از حلقه‌های bridging جلوگیری می‌کند. RouterOS پشتیبانی می‌کند از:

- \`none\` — بدون STP
- \`rstp\` — Rapid STP (توصیه‌شده)

\`\`\`
/interface bridge set bridge protocol-mode=rstp
\`\`\`

## مثال کامل: راه‌اندازی روتر خانگی

\`\`\`
# ایجاد bridge
/interface bridge add name=bridge protocol-mode=rstp

# اضافه کردن پورت‌های LAN
/interface bridge port add interface=ether2 bridge=bridge hw=yes
/interface bridge port add interface=ether3 bridge=bridge hw=yes
/interface bridge port add interface=ether4 bridge=bridge hw=yes
/interface bridge port add interface=ether5 bridge=bridge hw=yes

# اضافه کردن وایرلس (اگر دستگاه وایرلس دارد)
/interface bridge port add interface=wlan1 bridge=bridge
/interface bridge port add interface=wlan2 bridge=bridge

# تخصیص IP به bridge
/ip address add address=192.168.1.1/24 interface=bridge

# راه‌اندازی DHCP سرور
/ip pool add name=lan-pool ranges=192.168.1.100-192.168.1.200
/ip dhcp-server add name=dhcp-lan interface=bridge address-pool=lan-pool disabled=no
/ip dhcp-server network add address=192.168.1.0/24 gateway=192.168.1.1 dns-server=8.8.8.8
\`\`\`

## عیب‌یابی Bridge

\`\`\`
# پورت‌های bridge
/interface bridge port print

# جدول MAC (لایه ۲)
/interface bridge host print

# وضعیت bridge
/interface bridge print detail
\`\`\`

## جمع‌بندی

Bridge در RouterOS:

- وقتی چند پورت باید یک subnet باشند استفاده کنید
- \`/interface bridge add name=bridge\` — ایجاد bridge
- \`/interface bridge port add interface=etherX bridge=bridge\` — اضافه کردن پورت
- فقط به bridge آدرس IP بدهید، نه به پورت‌های جداگانه
- \`hw=yes\` برای hardware offload
- \`protocol-mode=rstp\` برای جلوگیری از حلقه
`,
  },
  'mikrotik-dns-resolver-setup': {
    contentEn: `## Configuring DNS on RouterOS

DNS (Domain Name System) is what allows your router and network devices to resolve domain names like \`google.com\` into IP addresses. Without proper DNS configuration, your MikroTik router will not be able to browse the internet by name, and neither will devices behind it if you use the router as their DNS server.

This guide covers everything you need to know about setting up DNS on RouterOS v7 from scratch.

## Setting DNS Servers

The first step is to tell your router which DNS servers to use. These are typically provided by your ISP, but you can also use public DNS servers like Google (8.8.8.8) or Cloudflare (1.1.1.1).

\`\`\`
/ip dns set servers=8.8.8.8,8.8.4.4
\`\`\`

To verify the setting:

\`\`\`
/ip dns print
\`\`\`

You will see output similar to:

\`\`\`
      servers: 8.8.8.8,8.8.4.4
allow-remote-requests: no
    cache-size: 2048KiB
 cache-max-ttl: 1w
      cache-used: 28KiB
\`\`\`

## Enabling allow-remote-requests

By default, the router only resolves DNS for itself. If you want devices on your LAN to use the router as their DNS server, you must enable \`allow-remote-requests\`:

\`\`\`
/ip dns set allow-remote-requests=yes
\`\`\`

This tells the router to accept DNS queries from other hosts on the network. Once enabled, you can point your DHCP server to hand out the router's LAN IP (e.g., 192.168.1.1) as the DNS server for clients.

### Security Note

When \`allow-remote-requests\` is enabled, make sure your firewall blocks DNS queries (UDP/TCP port 53) from the WAN interface so that external hosts cannot use your router as an open DNS resolver.

\`\`\`
/ip firewall filter add chain=input action=drop protocol=udp dst-port=53 in-interface=ether1 comment="Block external DNS"
/ip firewall filter add chain=input action=drop protocol=tcp dst-port=53 in-interface=ether1 comment="Block external DNS TCP"
\`\`\`

Replace \`ether1\` with your actual WAN interface name.

## Static DNS Entries

Static DNS entries let you map hostnames to specific IP addresses manually. This is useful for internal services, so that devices on your network can reach a local server by name.

\`\`\`
/ip dns static add name=nas.local address=192.168.1.50
/ip dns static add name=printer.local address=192.168.1.60
\`\`\`

To view all static entries:

\`\`\`
/ip dns static print
\`\`\`

You can also add CNAME-style aliases:

\`\`\`
/ip dns static add name=files.local cname=nas.local
\`\`\`

## DNS Caching Explained

RouterOS has a built-in DNS cache. When a client asks the router to resolve a domain, the router queries the upstream DNS server, gets the answer, and stores it locally for future requests. This reduces latency and saves bandwidth.

### Cache Settings

- **cache-size**: How much memory to allocate for DNS cache (default 2048 KiB).
- **cache-max-ttl**: Maximum time a record is kept in cache (default 1 week). Records with shorter TTLs from the server will expire sooner.

To increase cache size:

\`\`\`
/ip dns set cache-size=4096KiB
\`\`\`

To check what is currently cached:

\`\`\`
/ip dns cache print
\`\`\`

To flush the DNS cache (useful after making static entry changes):

\`\`\`
/ip dns cache flush
\`\`\`

## Using Multiple DNS Servers

You can specify multiple DNS servers separated by commas. RouterOS will try them in order:

\`\`\`
/ip dns set servers=1.1.1.1,8.8.8.8,9.9.9.9
\`\`\`

## Verifying DNS Resolution

Test that DNS is working correctly from the router itself:

\`\`\`
/resolve google.com
\`\`\`

This should return an IP address quickly. If it times out, check your WAN connection and your DNS server settings.

## Summary

- Set upstream DNS servers with \`/ip dns set servers=...\`
- Enable \`allow-remote-requests=yes\` to serve DNS to LAN clients
- Add static entries with \`/ip dns static add\`
- Protect your DNS port from external access with firewall rules
- Monitor and flush the cache as needed with \`/ip dns cache print\` and \`/ip dns cache flush\`

Proper DNS configuration is a foundation of a working network. Once set up, your router becomes a fast, local DNS resolver for all devices behind it.
`,
    contentFa: `## پیکربندی DNS در RouterOS

DNS (سیستم نام دامنه) به روتر و دستگاه‌های شبکه اجازه می‌دهد که نام‌هایی مثل \`google.com\` را به آدرس IP تبدیل کنند. بدون تنظیم درست DNS، روتر MikroTik شما نمی‌تواند اینترنت را با نام دامنه مرور کند.

## تنظیم سرور DNS

\`\`\`
/ip dns set servers=8.8.8.8,8.8.4.4
\`\`\`

برای مشاهده تنظیمات:

\`\`\`
/ip dns print
\`\`\`

## فعال کردن allow-remote-requests

اگر می‌خواهید دستگاه‌های داخل شبکه از روتر به عنوان DNS استفاده کنند:

\`\`\`
/ip dns set allow-remote-requests=yes
\`\`\`

### نکته امنیتی

وقتی این گزینه فعال است، حتماً با فایروال جلوی درخواست‌های DNS از اینترنت را بگیرید:

\`\`\`
/ip firewall filter add chain=input action=drop protocol=udp dst-port=53 in-interface=ether1 comment="Block external DNS"
\`\`\`

## ورودی‌های استاتیک DNS

برای اینکه یک نام خاص همیشه به یک IP مشخص اشاره کند:

\`\`\`
/ip dns static add name=nas.local address=192.168.1.50
/ip dns static add name=printer.local address=192.168.1.60
\`\`\`

مشاهده ورودی‌ها:

\`\`\`
/ip dns static print
\`\`\`

## کَش DNS

RouterOS به صورت خودکار پاسخ‌های DNS را در حافظه ذخیره می‌کند تا درخواست‌های بعدی سریع‌تر پاسخ داده شوند. برای پاک کردن کَش:

\`\`\`
/ip dns cache flush
\`\`\`

برای افزایش اندازه کَش:

\`\`\`
/ip dns set cache-size=4096KiB
\`\`\`

## تست DNS

برای اینکه مطمئن شوید DNS کار می‌کند:

\`\`\`
/resolve google.com
\`\`\`

اگر آدرس IP برگشت، تنظیمات درست است.

## خلاصه

- سرورهای DNS را با \`/ip dns set servers=...\` تنظیم کنید
- برای سرویس‌دهی به کلاینت‌ها \`allow-remote-requests=yes\` را فعال کنید
- ورودی‌های استاتیک برای سرورهای داخلی اضافه کنید
- کَش را در صورت نیاز پاک کنید
`,
  },
  'mikrotik-pppoe-client-isp': {
    contentEn: `## Setting Up a PPPoE Client Connection to an ISP

PPPoE (Point-to-Point Protocol over Ethernet) is one of the most common ways ISPs deliver internet access, especially for DSL and fiber connections. Your MikroTik router connects to the ISP by authenticating with a username and password over an Ethernet link.

This guide walks you through setting up a PPPoE client on RouterOS v7.

## What is PPPoE?

PPPoE wraps your internet traffic inside PPP frames that are sent over Ethernet. Your ISP assigns you an IP address after authentication. The key advantage is that PPPoE handles authentication centrally at the ISP side, so they know exactly who is connected.

## Prerequisites

- A MikroTik router with at least one Ethernet port connected to the ISP modem or ONT (fiber box).
- Your ISP-provided PPPoE username and password.

## Creating the PPPoE Client Interface

The command below creates a PPPoE client on \`ether1\` (your WAN port):

\`\`\`
/interface pppoe-client add name=pppoe-out1 interface=ether1 user=your_username password=your_password disabled=no add-default-route=yes use-peer-dns=yes
\`\`\`

Parameter breakdown:

- **name**: Name for this PPPoE interface (e.g., \`pppoe-out1\`).
- **interface**: The physical Ethernet port connected to the ISP (e.g., \`ether1\`).
- **user**: Your PPPoE username from the ISP.
- **password**: Your PPPoE password from the ISP.
- **disabled=no**: Activates the connection immediately.
- **add-default-route=yes**: Automatically adds a default gateway through the PPPoE link.
- **use-peer-dns=yes**: Uses the DNS servers provided by the ISP after connection.

## Verifying the Connection

After adding the interface, check its status:

\`\`\`
/interface pppoe-client print detail
\`\`\`

Look for \`status: connected\` and an IP address assigned under \`remote-address\`. You can also run:

\`\`\`
/ip address print
\`\`\`

You should see a dynamic IP address on the \`pppoe-out1\` interface.

Test connectivity from the router:

\`\`\`
/ping 8.8.8.8
\`\`\`

## MTU and MRU Considerations

PPPoE adds an 8-byte header to each Ethernet frame. Standard Ethernet MTU is 1500 bytes, so PPPoE effectively reduces usable MTU to **1492 bytes**. If you leave MTU at 1500 on your LAN but the PPPoE link only supports 1492, large packets will be fragmented or dropped, causing slow speeds and issues with certain sites.

### Fix with MSS Clamping

The best fix is to clamp the TCP Maximum Segment Size (MSS) so that TCP connections automatically negotiate a smaller packet size:

\`\`\`
/ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu passthrough=yes comment="PPPoE MSS fix"
\`\`\`

This rule modifies SYN packets so TCP connections use an MSS that fits inside the PPPoE MTU.

### Manually Setting MTU

You can also set the MTU on the PPPoE interface explicitly:

\`\`\`
/interface pppoe-client set pppoe-out1 mtu=1492 mru=1492
\`\`\`

## Default Route via PPPoE

When \`add-default-route=yes\` is set, RouterOS automatically creates a default route pointing through the PPPoE interface. You can verify this:

\`\`\`
/ip route print
\`\`\`

Look for a route with \`dst-address=0.0.0.0/0\` and \`gateway=pppoe-out1\`.

If you have multiple WAN links, you may want to manage routes manually:

\`\`\`
/interface pppoe-client set pppoe-out1 add-default-route=no
/ip route add dst-address=0.0.0.0/0 gateway=pppoe-out1 distance=1
\`\`\`

## Handling Disconnections

PPPoE links can drop. RouterOS will try to reconnect automatically. To configure reconnection behavior:

\`\`\`
/interface pppoe-client set pppoe-out1 dial-on-demand=no
\`\`\`

With \`dial-on-demand=no\` (the default), the router always tries to keep the connection alive.

## Protecting the WAN Interface

Since \`pppoe-out1\` is your public-facing interface, make sure your firewall protects it:

\`\`\`
/ip firewall filter add chain=input in-interface=pppoe-out1 connection-state=invalid action=drop
/ip firewall filter add chain=input in-interface=pppoe-out1 connection-state=established,related action=accept
/ip firewall filter add chain=input in-interface=pppoe-out1 action=drop
\`\`\`

## Summary

- Create PPPoE client with \`/interface pppoe-client add\`
- Use \`add-default-route=yes\` to route traffic through the ISP
- Fix MTU issues with MSS clamping or by setting MTU to 1492
- Verify connection with \`/interface pppoe-client print detail\` and \`/ping\`
- Protect the PPPoE interface with firewall rules

PPPoE is simple to configure on MikroTik once you understand the parameters. Most ISP connections are up and running within minutes of entering your credentials.
`,
    contentFa: `## راه‌اندازی اتصال PPPoE به اینترنت

PPPoE یکی از رایج‌ترین روش‌های اتصال به اینترنت است، به خصوص برای اشتراک‌های ADSL و فیبر نوری. روتر MikroTik شما با نام کاربری و رمز عبوری که ISP داده با اینترنت احراز هویت می‌کند.

## پیش‌نیازها

- یک پورت اترنت روتر به مودم یا ONT متصل باشد
- نام کاربری و رمز عبور PPPoE از ISP

## ساخت اینترفیس PPPoE

\`\`\`
/interface pppoe-client add name=pppoe-out1 interface=ether1 user=your_username password=your_password disabled=no add-default-route=yes use-peer-dns=yes
\`\`\`

توضیح پارامترها:

- **name**: نام اینترفیس PPPoE
- **interface**: پورت فیزیکی WAN (مثلاً ether1)
- **user** و **password**: اطلاعات ورود از ISP
- **add-default-route=yes**: مسیر پیش‌فرض از طریق PPPoE اضافه می‌شود
- **use-peer-dns=yes**: از DNS ارائه‌شده توسط ISP استفاده کن

## بررسی وضعیت اتصال

\`\`\`
/interface pppoe-client print detail
\`\`\`

باید \`status: connected\` را ببینید. همچنین:

\`\`\`
/ping 8.8.8.8
\`\`\`

## MTU در PPPoE

PPPoE هدر ۸ بایتی اضافه می‌کند، پس MTU واقعی ۱۴۹۲ بایت است. برای جلوگیری از مشکل:

\`\`\`
/ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu passthrough=yes comment="PPPoE MSS fix"
\`\`\`

یا به صورت دستی:

\`\`\`
/interface pppoe-client set pppoe-out1 mtu=1492 mru=1492
\`\`\`

## مسیر پیش‌فرض

برای بررسی مسیر پیش‌فرض:

\`\`\`
/ip route print
\`\`\`

باید مسیری با \`gateway=pppoe-out1\` وجود داشته باشد.

## محافظت از واسط WAN

\`\`\`
/ip firewall filter add chain=input in-interface=pppoe-out1 connection-state=invalid action=drop
/ip firewall filter add chain=input in-interface=pppoe-out1 connection-state=established,related action=accept
/ip firewall filter add chain=input in-interface=pppoe-out1 action=drop
\`\`\`

## خلاصه

- اینترفیس PPPoE را با \`/interface pppoe-client add\` بسازید
- MTU را با MSS clamping تنظیم کنید
- اتصال را با \`/ping\` تست کنید
- با فایروال از اینترفیس WAN محافظت کنید
`,
  },
  'mikrotik-user-management-security': {
    contentEn: `## Managing RouterOS Users: Security Best Practices

One of the most overlooked aspects of router security is user account management. By default, RouterOS comes with a single \`admin\` account with no password and full access. Leaving this default in place is a serious security risk on any network connected to the internet.

This guide covers how to create and manage users securely on RouterOS v7.

## Why User Management Matters

- Default \`admin\` with no password is the first thing attackers try.
- Different people (NOC staff, read-only viewers, automation accounts) need different access levels.
- Audit trails are easier when each person has their own account.
- Disabling the default admin reduces attack surface dramatically.

## Viewing Existing Users and Groups

\`\`\`
/user print
\`\`\`

\`\`\`
/user group print
\`\`\`

RouterOS has three built-in user groups:

- **full**: Complete access to all RouterOS features.
- **write**: Can change configuration but cannot manage users or access sensitive areas.
- **read**: View-only access, cannot make any changes.

## Creating a New Admin User

Always create a named admin account before disabling the default \`admin\`:

\`\`\`
/user add name=netadmin group=full password=Str0ng!P@ssw0rd comment="Primary admin account"
\`\`\`

Choose a strong password — at least 12 characters, mixing uppercase, lowercase, numbers, and symbols.

## Creating a Read-Only Account

For monitoring staff or NOC personnel who should view but not change configuration:

\`\`\`
/user add name=monitor group=read password=M0n!t0rPass comment="Read-only monitoring account"
\`\`\`

## Creating a Custom Group

If the built-in groups do not fit your needs, create a custom group with specific permissions:

\`\`\`
/user group add name=limited-ops policy=read,write,test,sniff
\`\`\`

Available policies include: \`local\`, \`telnet\`, \`ssh\`, \`ftp\`, \`reboot\`, \`read\`, \`write\`, \`policy\`, \`test\`, \`winbox\`, \`password\`, \`web\`, \`sniff\`, \`sensitive\`, \`api\`, \`romon\`, \`rest-api\`.

## Disabling the Default admin Account

After confirming your new admin account works (log in with it first!), disable the default:

\`\`\`
/user disable admin
\`\`\`

Or delete it entirely if you are confident:

\`\`\`
/user remove admin
\`\`\`

Warning: If you delete \`admin\` and then forget your new credentials, you will need to do a hard reset of the router. Always verify new accounts work before removing \`admin\`.

## Restricting Access by IP Address

You can limit where a user can log in from using the \`allowed-address\` field:

\`\`\`
/user set netadmin allowed-address=192.168.1.0/24
\`\`\`

This means \`netadmin\` can only log in from the 192.168.1.0/24 subnet. Attempts from other IPs will be rejected, even with the correct password.

## SSH Key Authentication

For even stronger security, use SSH public key authentication instead of passwords:

\`\`\`
/user ssh-keys import public-key-file=id_rsa.pub user=netadmin
\`\`\`

Upload the public key file first via FTP or SCP, then import it.

## Password Policy

RouterOS v7 does not enforce password complexity by default, but you can set a minimum password length:

\`\`\`
/user settings set minimum-password-length=12
\`\`\`

## Viewing Active Sessions

See who is currently logged in:

\`\`\`
/user active print
\`\`\`

To kick an active session:

\`\`\`
/user active remove [find name=someuser]
\`\`\`

## Securing Management Access

Combine user management with access controls on management services:

\`\`\`
/ip service set telnet disabled=yes
/ip service set ftp disabled=yes
/ip service set www disabled=yes
/ip service set api disabled=yes
/ip service set winbox address=192.168.1.0/24
/ip service set ssh address=192.168.1.0/24
\`\`\`

Disable services you do not use, and restrict the ones you do use to trusted subnets.

## Summary

- Never leave the default \`admin\` account with no password.
- Create named accounts with strong passwords.
- Use the \`read\` group for monitoring-only accounts.
- Restrict login by IP with \`allowed-address\`.
- Disable unused management services.
- Consider SSH key authentication for admin accounts.

User management is a low-effort, high-impact security improvement. A few minutes of configuration can prevent unauthorized access to your router.
`,
    contentFa: `## مدیریت کاربران RouterOS: امنیت حساب‌های کاربری

یکی از مهم‌ترین نکاتی که اغلب نادیده گرفته می‌شود، مدیریت حساب‌های کاربری روتر است. RouterOS به صورت پیش‌فرض یک حساب \`admin\` بدون رمز عبور دارد که دسترسی کامل را می‌دهد. این یک خطر امنیتی جدی است.

## مشاهده کاربران و گروه‌ها

\`\`\`
/user print
/user group print
\`\`\`

گروه‌های پیش‌فرض:
- **full**: دسترسی کامل
- **write**: تغییر تنظیمات بدون مدیریت کاربران
- **read**: فقط مشاهده

## ساخت کاربر ادمین جدید

قبل از غیرفعال کردن \`admin\` پیش‌فرض، یک کاربر جدید بسازید:

\`\`\`
/user add name=netadmin group=full password=Str0ng!P@ssw0rd comment="Primary admin account"
\`\`\`

## ساخت کاربر فقط‌خواندنی

\`\`\`
/user add name=monitor group=read password=M0n!t0rPass comment="Read-only monitoring account"
\`\`\`

## غیرفعال کردن admin پیش‌فرض

ابتدا با کاربر جدید لاگین کنید و مطمئن شوید که کار می‌کند، سپس:

\`\`\`
/user disable admin
\`\`\`

## محدود کردن دسترسی به IP مشخص

\`\`\`
/user set netadmin allowed-address=192.168.1.0/24
\`\`\`

## مشاهده جلسات فعال

\`\`\`
/user active print
\`\`\`

## امنیت سرویس‌های مدیریتی

\`\`\`
/ip service set telnet disabled=yes
/ip service set ftp disabled=yes
/ip service set winbox address=192.168.1.0/24
/ip service set ssh address=192.168.1.0/24
\`\`\`

## خلاصه

- هرگز \`admin\` بدون رمز نگذارید
- کاربران نامگذاری‌شده با رمز قوی بسازید
- دسترسی را با \`allowed-address\` محدود کنید
- سرویس‌های غیرضروری را غیرفعال کنید
`,
  },
  'mikrotik-backup-restore-export': {
    contentEn: `## Backing Up and Restoring RouterOS Configuration

Having a current backup of your router configuration is essential. Hardware can fail, misconfigurations can happen, and firmware upgrades can occasionally cause unexpected issues. A backup lets you recover quickly.

RouterOS offers two distinct backup methods, each with different use cases.

## Method 1: Binary Backup (/system backup)

A binary backup saves the entire RouterOS configuration in a compressed binary file. This is the fastest method and captures everything, including passwords.

### Creating a Backup

\`\`\`
/system backup save name=myrouter-2024-01-15
\`\`\`

This saves a file called \`myrouter-2024-01-15.backup\` to the router flash storage. To see it:

\`\`\`
/file print
\`\`\`

### Downloading the Backup

You can download the \`.backup\` file via Winbox (Files menu) or SCP:

\`\`\`
scp admin@192.168.1.1:myrouter-2024-01-15.backup ./
\`\`\`

### Restoring from Binary Backup

Upload the backup file to the router, then:

\`\`\`
/system backup load name=myrouter-2024-01-15.backup
\`\`\`

The router will reboot and restore the saved configuration. Note: This restores the configuration from the exact RouterOS version that created the backup. Restoring a backup from a very different version may cause issues.

### Password Protection

You can optionally add a password to the backup:

\`\`\`
/system backup save name=myrouter-2024-01-15 password=BackupPass123
\`\`\`

Then when restoring:

\`\`\`
/system backup load name=myrouter-2024-01-15.backup password=BackupPass123
\`\`\`

## Method 2: Export (/export)

The export command generates a human-readable \`.rsc\` script file containing RouterOS commands that recreate the configuration. This is more portable and version-independent.

### Full Export

\`\`\`
/export file=myrouter-export-2024-01-15
\`\`\`

This creates \`myrouter-export-2024-01-15.rsc\` — a plain text file you can open in any editor.

### Exporting a Specific Section

You can export just part of the configuration:

\`\`\`
/ip address export file=ip-addresses
/ip firewall export file=firewall-rules
/interface export file=interfaces
\`\`\`

### Viewing the Export Without Saving

\`\`\`
/export
\`\`\`

This prints the configuration to the terminal, useful for quickly reviewing settings.

### Compact Export (Hides Defaults)

\`\`\`
/export compact file=myrouter-compact
\`\`\`

The compact flag only shows settings that differ from RouterOS defaults, making the file smaller and easier to read.

### Restoring from Export

Upload the \`.rsc\` file to the router, then import it:

\`\`\`
/import file=myrouter-export-2024-01-15.rsc
\`\`\`

This runs the commands in the file line by line. If your router already has conflicting configuration, some commands may fail — it is best to import onto a fresh or reset router.

## Comparing the Two Methods

| Feature | /system backup | /export |
|---|---|---|
| Format | Binary | Plain text (.rsc) |
| Passwords | Included | Not included by default |
| Version dependency | Yes | No (mostly) |
| Human readable | No | Yes |
| Partial backup | No | Yes |
| Import on clean router | Yes | Yes |

## Best Practices

- **Schedule regular backups**: Use the RouterOS scheduler to run backups automatically.

\`\`\`
/system scheduler add name=weekly-backup interval=7d on-event="/system backup save name=auto-backup" start-time=00:00:00
\`\`\`

- **Store backups off-router**: Always download backups to a remote location. If the router dies, you cannot access files stored on it.
- **Test restores**: Periodically verify your backup actually works by restoring it to a test router.
- **Use both methods**: Keep a binary backup for fast recovery and an export for version portability.
- **Name files with dates**: Include the date in the file name so you know which backup is most recent.

## Sending Backups via Email

RouterOS can email backups automatically:

\`\`\`
/tool e-mail set server=smtp.example.com from=router@example.com
/system scheduler add name=email-backup interval=7d on-event="/system backup save name=weekly; /tool e-mail send to=admin@example.com subject=RouterBackup file=weekly.backup"
\`\`\`

## Summary

- Use \`/system backup save\` for quick, complete binary backups.
- Use \`/export\` for human-readable, portable configuration scripts.
- Always store backups off the router.
- Schedule automatic backups with \`/system scheduler\`.
- Test your backups regularly to ensure they actually work.
`,
    contentFa: `## پشتیبان‌گیری و بازیابی تنظیمات RouterOS

داشتن پشتیبان به‌روز از تنظیمات روتر ضروری است. RouterOS دو روش پشتیبان‌گیری دارد.

## روش اول: پشتیبان باینری (/system backup)

\`\`\`
/system backup save name=myrouter-2024-01-15
\`\`\`

فایل \`myrouter-2024-01-15.backup\` در حافظه روتر ذخیره می‌شود.

### بازیابی از پشتیبان باینری

\`\`\`
/system backup load name=myrouter-2024-01-15.backup
\`\`\`

روتر ری‌استارت می‌شود و تنظیمات بازیابی می‌شوند.

### پشتیبان با رمز عبور

\`\`\`
/system backup save name=myrouter-2024-01-15 password=BackupPass123
\`\`\`

## روش دوم: Export (/export)

فایل متنی قابل‌خواندن تولید می‌کند:

\`\`\`
/export file=myrouter-export-2024-01-15
\`\`\`

### Export بخشی از تنظیمات

\`\`\`
/ip address export file=ip-addresses
/ip firewall export file=firewall-rules
\`\`\`

### Export فشرده (بدون مقادیر پیش‌فرض)

\`\`\`
/export compact file=myrouter-compact
\`\`\`

### بازیابی از Export

\`\`\`
/import file=myrouter-export-2024-01-15.rsc
\`\`\`

## بهترین روش‌ها

- پشتیبان‌گیری خودکار با زمان‌بندی:

\`\`\`
/system scheduler add name=weekly-backup interval=7d on-event="/system backup save name=auto-backup" start-time=00:00:00
\`\`\`

- همیشه پشتیبان را از روتر دانلود کنید
- هر دو روش را ترکیب کنید
- نام فایل را با تاریخ مشخص کنید

## خلاصه

- برای پشتیبان کامل سریع از \`/system backup save\` استفاده کنید
- برای فایل قابل‌ویرایش از \`/export\` استفاده کنید
- پشتیبان‌ها را خارج از روتر نگهداری کنید
- پشتیبان‌ها را به صورت خودکار زمان‌بندی کنید
`,
  },
  'mikrotik-routeros-upgrade-safe': {
    contentEn: `## Safely Upgrading RouterOS Firmware

Keeping RouterOS up to date is important for security patches, bug fixes, and new features. However, upgrades should be done carefully — a failed upgrade can leave a router unreachable. This guide walks you through a safe upgrade process for RouterOS v7.

## Before You Upgrade

### 1. Check Current Version

\`\`\`
/system resource print
\`\`\`

Look for the \`version\` field. Also check:

\`\`\`
/system routerboard print
\`\`\`

This shows the RouterBOARD model and firmware version separately from the RouterOS software version.

### 2. Take a Full Backup

Always back up before upgrading:

\`\`\`
/system backup save name=pre-upgrade-backup
\`\`\`

Download this backup to your computer. If the upgrade fails, you may need it.

### 3. Check Available Packages

\`\`\`
/system package print
\`\`\`

This shows all installed packages and their current versions.

## Checking for Updates

### Method 1: Check via RouterOS

\`\`\`
/system package update check-for-updates channel=stable
\`\`\`

Channels available:
- **stable**: Recommended for production. Thoroughly tested releases.
- **long-term**: Even more conservative. Bug fixes only for a specific major version.
- **testing**: Beta releases. Do not use in production.
- **development**: Nightly builds. Never use in production.

### Method 2: Manual Download from MikroTik

Go to https://mikrotik.com/download and download the correct package for your router architecture. Common architectures:
- **arm**: Most modern home/office routers (hEX, RB4011, etc.)
- **arm64**: Newer high-end devices
- **mipsbe**: Older/budget devices (RB750, hAP lite)
- **x86**: CHR (Cloud Hosted Router) and PC-based routers
- **tile**: CCR series (Cloud Core Router)

Check your architecture:

\`\`\`
/system resource print | grep architecture
\`\`\`

## Upgrading via RouterOS (Recommended for Most Users)

If your router has internet access, the easiest method is to upgrade directly:

\`\`\`
/system package update check-for-updates channel=stable
/system package update download
\`\`\`

Wait for the download to complete, then:

\`\`\`
/system package update install
\`\`\`

The router will reboot and install the new version.

## Upgrading via Package Upload

If you downloaded packages manually:

1. Upload the \`.npk\` package file to the router (via Winbox Files, or SCP/FTP).
2. Verify it appears in the file list:

\`\`\`
/file print
\`\`\`

3. Reboot to trigger the upgrade:

\`\`\`
/system reboot
\`\`\`

RouterOS installs any \`.npk\` files found in the root directory during boot.

## Upgrading the RouterBOARD Firmware

After upgrading RouterOS software, you should also upgrade the low-level RouterBOARD firmware:

\`\`\`
/system routerboard upgrade
/system reboot
\`\`\`

This updates the bootloader and hardware-level firmware. It is separate from RouterOS and must be done after the RouterOS upgrade.

## Rollback Plan

### If the Router is Unreachable After Upgrade

RouterOS has a built-in rollback feature — if the router reboots three times without a successful connection within a configured time, it can revert to the previous version. However, this is not always reliable.

More reliable rollback steps:

1. **Netinstall**: MikroTik's utility to reinstall RouterOS over the network. Requires physical access (press the reset button while powering on).
2. **Restore from backup**: Use Netinstall to get a clean RouterOS, then restore your pre-upgrade backup.

### Keeping the Old Version Available

Before upgrading, note the old version number. You can download older RouterOS versions from https://mikrotik.com/download (scroll down for older releases).

## Safe Upgrade Checklist

- [ ] Check current version with \`/system resource print\`
- [ ] Take and download a full backup
- [ ] Verify the correct architecture package
- [ ] Read the RouterOS changelog for breaking changes
- [ ] Schedule the upgrade during a maintenance window
- [ ] Have console/out-of-band access ready in case the router is unreachable
- [ ] Test after upgrade: ping, DNS, NAT, firewall

## Summary

- Always back up before upgrading.
- Use the \`stable\` channel for production routers.
- Upgrade RouterOS first, then upgrade the RouterBOARD firmware.
- Know your rollback plan before starting.
- Read the changelog for any breaking changes in the new version.

Routine upgrades on a planned maintenance window, with a backup ready, are low-risk and keep your network secure.
`,
    contentFa: `## ارتقاء ایمن RouterOS

به‌روز نگه داشتن RouterOS برای امنیت و رفع اشکالات ضروری است. با این حال باید با احتیاط انجام شود.

## قبل از ارتقاء

### ۱. بررسی نسخه فعلی

\`\`\`
/system resource print
\`\`\`

### ۲. گرفتن پشتیبان کامل

\`\`\`
/system backup save name=pre-upgrade-backup
\`\`\`

این فایل را دانلود کنید.

### ۳. بررسی پکیج‌های نصب‌شده

\`\`\`
/system package print
\`\`\`

## بررسی به‌روزرسانی‌ها

\`\`\`
/system package update check-for-updates channel=stable
\`\`\`

کانال‌ها:
- **stable**: برای محیط تولید توصیه می‌شود
- **long-term**: محافظه‌کارانه‌تر، فقط رفع اشکال
- **testing**: نسخه بتا، برای تولید مناسب نیست

## ارتقاء از طریق RouterOS

\`\`\`
/system package update check-for-updates channel=stable
/system package update download
/system package update install
\`\`\`

روتر ری‌استارت می‌شود و نسخه جدید نصب می‌شود.

## ارتقاء RouterBOARD firmware

بعد از ارتقاء RouterOS:

\`\`\`
/system routerboard upgrade
/system reboot
\`\`\`

## چک‌لیست ارتقاء ایمن

- نسخه فعلی را یادداشت کنید
- پشتیبان کامل بگیرید و دانلود کنید
- معماری درست را انتخاب کنید (arm, mipsbe, x86, ...)
- changelog را بخوانید
- در ساعات کم‌ترافیک انجام دهید
- دسترسی کنسول داشته باشید

## معماری روتر

\`\`\`
/system resource print | grep architecture
\`\`\`

## خلاصه

- همیشه قبل از ارتقاء پشتیبان بگیرید
- از کانال \`stable\` برای روترهای تولیدی استفاده کنید
- بعد از RouterOS، firmware RouterBOARD را هم ارتقاء دهید
- برنامه بازگشت داشته باشید
`,
  },
  'mikrotik-logging-system-remote': {
    contentEn: `## System Logging in RouterOS

Logging is critical for troubleshooting, security auditing, and understanding what is happening on your network. RouterOS has a flexible logging system that can send logs to multiple destinations simultaneously.

## Understanding the Logging System

RouterOS logging works with two components:

- **Log topics**: Categories of events (e.g., \`firewall\`, \`dhcp\`, \`system\`, \`interface\`).
- **Log actions**: Where to send the log messages (memory, disk, console, email, remote syslog).

## Viewing Logs

The simplest way to see logs is:

\`\`\`
/log print
\`\`\`

To follow logs in real time:

\`\`\`
/log print follow
\`\`\`

To filter by topic:

\`\`\`
/log print where topics~"firewall"
\`\`\`

## Configuring Log Actions

By default, RouterOS has four built-in log actions:

- **memory**: Stores logs in RAM (lost on reboot). Default for most events.
- **disk**: Stores logs in flash storage. Survives reboots but wears flash.
- **echo**: Prints to the console terminal.
- **remote**: Sends logs to a syslog server.

View existing actions:

\`\`\`
/system logging action print
\`\`\`

### Configuring Memory Action

\`\`\`
/system logging action set memory memory-lines=1000
\`\`\`

This keeps the last 1000 log lines in memory.

### Configuring Disk Action

\`\`\`
/system logging action set disk disk-lines-per-file=1000 disk-file-count=5 disk-file-name=router-log
\`\`\`

This creates up to 5 rotating log files with 1000 lines each.

## Sending Logs to a Remote Syslog Server

This is the most important feature for any serious network. Sending logs to a central syslog server means:

- Logs survive router reboots or crashes.
- You can correlate logs from multiple devices.
- Logs are harder for an attacker to tamper with.

### Step 1: Configure the Remote Action

\`\`\`
/system logging action add name=remote-syslog target=remote remote=192.168.1.100 remote-port=514 syslog-facility=local0 syslog-severity=auto bsd-syslog=no
\`\`\`

Parameters:
- **remote**: IP of your syslog server (e.g., a Linux box running \`rsyslog\` or \`syslog-ng\`).
- **remote-port**: Default syslog port is 514 (UDP).
- **syslog-facility**: The syslog facility code (local0 through local7 are commonly used for network devices).
- **bsd-syslog**: Set to \`yes\` for RFC 3164 (older) format, \`no\` for RFC 5424 (newer).

### Step 2: Add Logging Rules to Use the Remote Action

\`\`\`
/system logging add topics=firewall action=remote-syslog
/system logging add topics=system action=remote-syslog
/system logging add topics=critical action=remote-syslog
/system logging add topics=warning action=remote-syslog
/system logging add topics=info action=remote-syslog
\`\`\`

### Step 3: Verify

Check that log entries are appearing on your syslog server. On a Linux syslog server:

\`\`\`bash
tail -f /var/log/syslog | grep <router-ip>
\`\`\`

## What to Log and Why

Not all log topics are equally useful. Here is a guide:

| Topic | Why Log It |
|---|---|
| \`firewall\` | See blocked/accepted connections, detect attacks |
| \`system\` | Track reboots, config changes, user logins |
| \`dhcp\` | See which devices get IP addresses |
| \`dns\` | Debug DNS resolution issues |
| \`interface\` | Track link up/down events |
| \`critical\` | Always log critical errors |
| \`warning\` | Hardware warnings, resource issues |
| \`info\` | General informational events |

Avoid logging \`debug\` in production — it generates enormous volume and fills logs quickly.

## Configuring Log Topics

View current logging rules:

\`\`\`
/system logging print
\`\`\`

Add a logging rule for DHCP events going to memory and syslog:

\`\`\`
/system logging add topics=dhcp action=memory
/system logging add topics=dhcp action=remote-syslog
\`\`\`

Remove a logging rule:

\`\`\`
/system logging remove [find topics="dhcp"]
\`\`\`

## Log Prefixes

You can add a prefix to log messages for easier filtering:

\`\`\`
/system logging add topics=firewall action=remote-syslog prefix="FW:"
\`\`\`

## Logging Firewall Events

To log specific firewall events, add the \`log\` action and a \`log-prefix\` to your firewall rules:

\`\`\`
/ip firewall filter add chain=input action=drop in-interface=pppoe-out1 log=yes log-prefix="WAN-DROP:"
\`\`\`

These events will appear in the log under the \`firewall\` topic.

## Summary

- View logs with \`/log print\` and \`/log print follow\`.
- Configure actions with \`/system logging action\`.
- Send logs to a remote syslog server for persistence and centralization.
- Log \`firewall\`, \`system\`, \`critical\`, \`warning\`, and \`info\` at minimum.
- Avoid debug logging in production.
- Add log prefixes for easier searching.
`,
    contentFa: `## لاگ‌گیری سیستم در RouterOS

لاگ‌گیری برای عیب‌یابی، امنیت و درک رویدادهای شبکه ضروری است.

## مشاهده لاگ‌ها

\`\`\`
/log print
\`\`\`

برای دیدن لاگ‌ها به صورت زنده:

\`\`\`
/log print follow
\`\`\`

فیلتر بر اساس موضوع:

\`\`\`
/log print where topics~"firewall"
\`\`\`

## اکشن‌های لاگ‌گیری

اکشن‌های پیش‌فرض:
- **memory**: در RAM ذخیره می‌شود (با ری‌استارت پاک می‌شود)
- **disk**: در فلش ذخیره می‌شود
- **echo**: در کنسول نمایش می‌دهد
- **remote**: به سرور syslog ارسال می‌شود

مشاهده اکشن‌ها:

\`\`\`
/system logging action print
\`\`\`

## ارسال لاگ به سرور syslog از راه دور

این مهم‌ترین قابلیت برای شبکه‌های جدی است:

### مرحله ۱: پیکربندی اکشن remote

\`\`\`
/system logging action add name=remote-syslog target=remote remote=192.168.1.100 remote-port=514 syslog-facility=local0 syslog-severity=auto bsd-syslog=no
\`\`\`

### مرحله ۲: اضافه کردن قوانین لاگ

\`\`\`
/system logging add topics=firewall action=remote-syslog
/system logging add topics=system action=remote-syslog
/system logging add topics=critical action=remote-syslog
/system logging add topics=warning action=remote-syslog
\`\`\`

## چه چیزی را لاگ بگیریم؟

| موضوع | دلیل |
|---|---|
| \`firewall\` | شناسایی حملات |
| \`system\` | ری‌استارت‌ها، تغییرات تنظیمات |
| \`dhcp\` | پیگیری دستگاه‌های متصل |
| \`interface\` | بررسی وضعیت اینترفیس‌ها |
| \`critical\` | خطاهای بحرانی |

از لاگ \`debug\` در محیط تولید استفاده نکنید.

## لاگ رویدادهای فایروال

\`\`\`
/ip firewall filter add chain=input action=drop in-interface=pppoe-out1 log=yes log-prefix="WAN-DROP:"
\`\`\`

## خلاصه

- لاگ‌ها را با \`/log print\` مشاهده کنید
- برای ماندگاری، لاگ‌ها را به سرور syslog ارسال کنید
- حداقل \`firewall\`، \`system\`، \`critical\` و \`warning\` را لاگ بگیرید
`,
  },
  'mikrotik-snmp-monitoring-setup': {
    contentEn: `## Enabling SNMP for Network Monitoring

SNMP (Simple Network Management Protocol) allows external monitoring tools to query your MikroTik router for performance data, interface statistics, CPU usage, memory, and much more. Tools like LibreNMS, Zabbix, PRTG, and Grafana+Prometheus can use SNMP to build dashboards and send alerts.

## What is SNMP?

SNMP is a protocol designed to let network management software poll devices for information. A device running SNMP is called an **agent**. The monitoring server is called the **manager**. The manager sends requests to the agent, and the agent responds with data.

Data in SNMP is organized in a tree structure called the **MIB (Management Information Base)**. Each piece of data has a unique identifier called an **OID (Object Identifier)**, like \`1.3.6.1.2.1.1.1.0\` (which is \`sysDescr\` — the system description).

RouterOS v7 supports:
- **SNMPv1**: Legacy, no security. Avoid if possible.
- **SNMPv2c**: Most common. Uses community strings for basic authentication.
- **SNMPv3**: Adds encryption and strong authentication. Recommended for security.

## Enabling SNMP

\`\`\`
/snmp set enabled=yes
\`\`\`

## Configuring Community Strings (SNMPv2c)

A community string acts like a password. By default, the community is \`public\` — change this immediately.

\`\`\`
/snmp community add name=monitoring-ro security=none read-access=yes write-access=no addresses=192.168.1.100
\`\`\`

Parameters:
- **name**: The community string name (this IS the password for SNMPv2c).
- **read-access=yes**: Allow reading data.
- **write-access=no**: Never allow write access unless you specifically need it.
- **addresses**: Restrict which IP can query this community (highly recommended).

Remove or disable the default \`public\` community:

\`\`\`
/snmp community remove [find name=public]
\`\`\`

## Basic SNMP Settings

\`\`\`
/snmp set contact="Network Admin <admin@example.com>" location="Server Room A" engine-id=auto trap-version=2 trap-community=monitoring-ro
\`\`\`

- **contact**: Who to contact about this device.
- **location**: Physical location of the router.
- **engine-id**: Unique ID for this SNMP agent (auto-generate is fine).
- **trap-version**: Version for SNMP traps (notifications sent from router to manager).

## Verifying SNMP is Working

From your monitoring server, test with \`snmpwalk\` (Linux):

\`\`\`bash
snmpwalk -v2c -c monitoring-ro 192.168.1.1 1.3.6.1.2.1.1
\`\`\`

This queries the system group OIDs and should return basic router information.

Test a specific OID — system uptime:

\`\`\`bash
snmpget -v2c -c monitoring-ro 192.168.1.1 1.3.6.1.2.1.1.3.0
\`\`\`

## Useful MikroTik OIDs

| OID | Description |
|---|---|
| \`1.3.6.1.2.1.1.1.0\` | System description |
| \`1.3.6.1.2.1.1.3.0\` | System uptime |
| \`1.3.6.1.2.1.1.5.0\` | System name |
| \`1.3.6.1.2.1.2.2.1.10.X\` | Interface X received bytes |
| \`1.3.6.1.2.1.2.2.1.16.X\` | Interface X transmitted bytes |
| \`1.3.6.1.4.1.14988.1.1.1.1.0\` | CPU load (MikroTik MIB) |
| \`1.3.6.1.4.1.14988.1.1.1.2.0\` | Free memory |

MikroTik-specific OIDs start with \`1.3.6.1.4.1.14988\` (MikroTik enterprise OID).

## Configuring SNMPv3 (Recommended)

SNMPv3 adds user-based authentication and optional encryption:

\`\`\`
/snmp community add name=snmpv3-user security=SHA authentication-password=AuthPass123 encryption-password=EncPass123 encryption-protocol=AES read-access=yes addresses=192.168.1.100
\`\`\`

From the monitoring server:

\`\`\`bash
snmpwalk -v3 -u snmpv3-user -l authPriv -a SHA -A AuthPass123 -x AES -X EncPass123 192.168.1.1 1.3.6.1.2.1.1
\`\`\`

## Integrating with LibreNMS

1. Install LibreNMS on your monitoring server.
2. In LibreNMS, go to **Devices > Add Device**.
3. Enter the router IP, select SNMPv2c (or v3), enter your community string.
4. LibreNMS will auto-discover interfaces, CPU, memory, and more.
5. Set up alerts for interface down, high CPU, memory issues.

## Integrating with Zabbix

1. In Zabbix, create a host with your router IP.
2. Link the **Template Net MikroTik** template (available in Zabbix template library).
3. Set the SNMP community macro \`{$SNMP_COMMUNITY}\` to your community string.
4. Zabbix will automatically discover and monitor interfaces, CPU, memory, uptime.

## Protecting SNMP

SNMP v2c has no encryption — community strings are sent in plain text. Protect yourself:

\`\`\`
/ip firewall filter add chain=input protocol=udp dst-port=161 src-address=192.168.1.100 action=accept comment="Allow SNMP from monitor"
/ip firewall filter add chain=input protocol=udp dst-port=161 action=drop comment="Block all other SNMP"
\`\`\`

Only allow your monitoring server to reach SNMP (UDP port 161).

## Summary

- Enable SNMP with \`/snmp set enabled=yes\`.
- Change the default community string from \`public\` to something custom.
- Restrict SNMP access to your monitoring server IP.
- Use SNMPv3 when possible for security.
- Integrate with LibreNMS, Zabbix, or similar for dashboards and alerts.
- Block SNMP on the firewall from any unauthorized source.
`,
    contentFa: `## فعال کردن SNMP برای مانیتورینگ شبکه

SNMP به ابزارهای مانیتورینگ اجازه می‌دهد اطلاعات روتر مثل CPU، حافظه و ترافیک اینترفیس‌ها را جمع‌آوری کنند. ابزارهایی مثل LibreNMS، Zabbix و Grafana از SNMP استفاده می‌کنند.

## فعال کردن SNMP

\`\`\`
/snmp set enabled=yes
\`\`\`

## پیکربندی Community String

Community string مثل رمز عبور است. مقدار پیش‌فرض \`public\` را تغییر دهید:

\`\`\`
/snmp community add name=monitoring-ro security=none read-access=yes write-access=no addresses=192.168.1.100
\`\`\`

Community پیش‌فرض را حذف کنید:

\`\`\`
/snmp community remove [find name=public]
\`\`\`

## تنظیمات پایه SNMP

\`\`\`
/snmp set contact="Network Admin <admin@example.com>" location="Server Room A" engine-id=auto trap-version=2 trap-community=monitoring-ro
\`\`\`

## تست SNMP

از سرور مانیتورینگ:

\`\`\`bash
snmpwalk -v2c -c monitoring-ro 192.168.1.1 1.3.6.1.2.1.1
\`\`\`

## OIDهای مفید MikroTik

| OID | توضیح |
|---|---|
| \`1.3.6.1.2.1.1.1.0\` | توضیحات سیستم |
| \`1.3.6.1.2.1.1.3.0\` | آپتایم سیستم |
| \`1.3.6.1.4.1.14988.1.1.1.1.0\` | بار CPU |
| \`1.3.6.1.4.1.14988.1.1.1.2.0\` | حافظه آزاد |

## SNMPv3 (توصیه‌شده)

\`\`\`
/snmp community add name=snmpv3-user security=SHA authentication-password=AuthPass123 encryption-password=EncPass123 encryption-protocol=AES read-access=yes addresses=192.168.1.100
\`\`\`

## محافظت از SNMP با فایروال

\`\`\`
/ip firewall filter add chain=input protocol=udp dst-port=161 src-address=192.168.1.100 action=accept comment="Allow SNMP from monitor"
/ip firewall filter add chain=input protocol=udp dst-port=161 action=drop comment="Block all other SNMP"
\`\`\`

## خلاصه

- SNMP را با \`/snmp set enabled=yes\` فعال کنید
- Community string را تغییر دهید
- دسترسی را به سرور مانیتورینگ محدود کنید
- در صورت امکان از SNMPv3 استفاده کنید
`,
  },
  'mikrotik-simple-queue-bandwidth': {
    contentEn: `## Basic Bandwidth Limiting with Simple Queues

If you have multiple users on your network and want to make sure no single user consumes all the bandwidth, Simple Queues are your first tool in RouterOS. They are easy to configure and effective for basic bandwidth management.

## What is a Queue?

A queue is a mechanism that controls how much data can flow through at a given time. By adding a queue for a specific IP address or subnet, you can set maximum upload and download speeds for that target.

## Creating a Simple Queue

The basic syntax is:

\`\`\`
/queue simple add name=limit-pc1 target=192.168.1.10/32 max-limit=5M/10M
\`\`\`

This creates a queue named \`limit-pc1\` that limits:
- Upload (target to internet): 5 Mbps
- Download (internet to target): 10 Mbps

The format for \`max-limit\` is \`upload/download\`.

## Limiting an Entire Subnet

To limit all devices in a subnet:

\`\`\`
/queue simple add name=limit-guest-wifi target=192.168.10.0/24 max-limit=20M/50M
\`\`\`

All devices in the 192.168.10.0/24 range share a total of 20 Mbps up and 50 Mbps down.

## Viewing Queues

\`\`\`
/queue simple print
\`\`\`

To see live statistics:

\`\`\`
/queue simple print stats
\`\`\`

This shows bytes and packets passed through each queue, and whether any traffic is being dropped.

## Burst Limits

Burst allows a user to temporarily exceed the max-limit for a short time. This makes browsing feel faster because small page loads complete quickly before the limit kicks in.

\`\`\`
/queue simple add name=limit-user1 target=192.168.1.20/32 max-limit=5M/10M burst-limit=10M/20M burst-threshold=3M/6M burst-time=8/8
\`\`\`

How burst works:
- **burst-limit**: Maximum speed allowed during burst (10M up / 20M down).
- **burst-threshold**: Average speed below which burst is allowed (3M up / 6M down).
- **burst-time**: How many seconds the router averages traffic to decide if burst is available (8 seconds).

If the average traffic over 8 seconds stays below \`burst-threshold\`, the router allows \`burst-limit\` speed. Once average traffic exceeds \`burst-threshold\`, it drops back to \`max-limit\`.

## Priority Settings

When multiple queues compete for bandwidth, priority determines which gets served first:

\`\`\`
/queue simple add name=voip-traffic target=192.168.1.30/32 max-limit=2M/2M priority=1/1
/queue simple add name=bulk-download target=192.168.1.31/32 max-limit=10M/20M priority=8/8
\`\`\`

Priority 1 is highest, 8 is lowest. VoIP traffic will always be served before bulk downloads.

## Limiting by MAC Address (via ARP)

Simple queues target IP addresses, not MAC addresses directly. However, you can use static ARP entries to ensure a specific MAC always gets the same IP, then queue that IP.

## Common Use Cases

### Home Network

Limit streaming device so it does not starve others:

\`\`\`
/queue simple add name=smart-tv target=192.168.1.50/32 max-limit=15M/30M comment="Smart TV limit"
\`\`\`

### Small Business

Give each department a slice of bandwidth:

\`\`\`
/queue simple add name=accounts target=192.168.1.0/25 max-limit=20M/50M
/queue simple add name=warehouse target=192.168.1.128/25 max-limit=10M/20M
\`\`\`

### Guest WiFi

Ensure guest users get limited access:

\`\`\`
/queue simple add name=guests target=192.168.100.0/24 max-limit=5M/10M comment="Guest WiFi"
\`\`\`

## Disabling a Queue Temporarily

\`\`\`
/queue simple disable limit-pc1
\`\`\`

Re-enable:

\`\`\`
/queue simple enable limit-pc1
\`\`\`

## Removing a Queue

\`\`\`
/queue simple remove limit-pc1
\`\`\`

## Important Notes

- Simple Queues match traffic after NAT. For typical home/office setups, target the LAN IP addresses.
- Queue order matters: RouterOS processes queues top-to-bottom. More specific rules (single host /32) should come before broader rules (subnets).
- Simple Queues add processing overhead. For large networks with hundreds of queues, consider using Queue Trees instead.

## Summary

- Create queues with \`/queue simple add target=... max-limit=...\`
- Use \`upload/download\` format for max-limit.
- Add burst settings for better user experience.
- Use priority levels to prefer important traffic.
- View stats with \`/queue simple print stats\`.
- Disable with \`/queue simple disable name\`.
`,
    contentFa: `## محدود کردن پهنای باند با Simple Queue

اگر می‌خواهید اطمینان حاصل کنید که هیچ کاربری تمام پهنای باند را نمی‌گیرد، Simple Queue ابزار اول شما در RouterOS است.

## ساخت یک Simple Queue

\`\`\`
/queue simple add name=limit-pc1 target=192.168.1.10/32 max-limit=5M/10M
\`\`\`

این queue آپلود را به ۵ مگابیت و دانلود را به ۱۰ مگابیت محدود می‌کند.

فرمت \`max-limit\` به صورت \`آپلود/دانلود\` است.

## محدود کردن یک زیرشبکه

\`\`\`
/queue simple add name=limit-guest-wifi target=192.168.10.0/24 max-limit=20M/50M
\`\`\`

تمام دستگاه‌های این شبکه مجموعاً ۲۰ مگابیت آپلود و ۵۰ مگابیت دانلود دارند.

## مشاهده Queueها

\`\`\`
/queue simple print
/queue simple print stats
\`\`\`

## Burst (ترافیک موقت بالاتر)

\`\`\`
/queue simple add name=limit-user1 target=192.168.1.20/32 max-limit=5M/10M burst-limit=10M/20M burst-threshold=3M/6M burst-time=8/8
\`\`\`

Burst اجازه می‌دهد کاربر برای مدت کوتاهی بالاتر از حد مجاز برود.

## اولویت‌بندی

\`\`\`
/queue simple add name=voip-traffic target=192.168.1.30/32 max-limit=2M/2M priority=1/1
/queue simple add name=bulk-download target=192.168.1.31/32 max-limit=10M/20M priority=8/8
\`\`\`

اولویت ۱ بالاترین است. ترافیک VoIP همیشه قبل از دانلودهای سنگین سرویس می‌گیرد.

## مثال‌های رایج

### شبکه خانگی

\`\`\`
/queue simple add name=smart-tv target=192.168.1.50/32 max-limit=15M/30M comment="Smart TV limit"
\`\`\`

### شبکه اداری

\`\`\`
/queue simple add name=accounts target=192.168.1.0/25 max-limit=20M/50M
/queue simple add name=guests target=192.168.100.0/24 max-limit=5M/10M
\`\`\`

## غیرفعال کردن موقت

\`\`\`
/queue simple disable limit-pc1
/queue simple enable limit-pc1
\`\`\`

## خلاصه

- queue را با \`/queue simple add\` بسازید
- فرمت \`آپلود/دانلود\` برای max-limit استفاده کنید
- با burst تجربه بهتری برای کاربران ایجاد کنید
- اولویت‌بندی را برای ترافیک مهم تنظیم کنید
`,
  },
  'mikrotik-pcq-fair-bandwidth': {
    contentEn: `## Fair Bandwidth Sharing with PCQ (Per Connection Queue)

While Simple Queues give each IP address a fixed bandwidth limit, PCQ (Per Connection Queue) takes a different approach: it automatically divides available bandwidth equally among active users or connections. This is ideal when you want fairness without manually creating a queue for every user.

## What is PCQ?

PCQ is a queuing discipline that splits bandwidth dynamically. Instead of assigning a fixed limit per user, PCQ observes all active flows and tries to give each one an equal share. If you have 10 users active, each gets roughly 1/10 of the total bandwidth.

PCQ is particularly useful for:
- Shared internet connections serving many users.
- ISP-style fair access policies.
- Preventing one heavy user from saturating the link while others are idle.

## PCQ Concepts

- **pcq-rate**: Optional maximum rate per sub-stream (each classified flow). Set to 0 for no per-stream limit.
- **pcq-limit**: Queue depth per sub-stream (how many packets to buffer before dropping).
- **pcq-classifier**: What field is used to classify flows into sub-streams. Options: \`src-address\`, \`dst-address\`, \`src-port\`, \`dst-port\`.
- **pcq-total-limit**: Maximum total packets in the queue across all sub-streams.

## Step 1: Create PCQ Queue Types

First, define the PCQ queue types for download and upload:

\`\`\`
/queue type add name=pcq-download kind=pcq pcq-classifier=dst-address pcq-rate=0 pcq-limit=50 pcq-total-limit=2000
/queue type add name=pcq-upload kind=pcq pcq-classifier=src-address pcq-rate=0 pcq-limit=50 pcq-total-limit=2000
\`\`\`

For download: classify by \`dst-address\` — each destination IP (your LAN users) gets a fair share.
For upload: classify by \`src-address\` — each source IP (your LAN users) gets a fair share.

## Step 2: Create a Queue Tree

PCQ works best in a Queue Tree, which lets you set a total bandwidth limit and then apply PCQ within that total.

First, mark all traffic from the WAN interface (for download) and to the WAN (for upload):

\`\`\`
/ip firewall mangle add chain=forward in-interface=pppoe-out1 action=mark-packet new-packet-mark=wan-download passthrough=yes
/ip firewall mangle add chain=forward out-interface=pppoe-out1 action=mark-packet new-packet-mark=wan-upload passthrough=yes
\`\`\`

Then create the Queue Tree:

\`\`\`
/queue tree add name=total-download parent=global packet-mark=wan-download max-limit=100M queue=pcq-download
/queue tree add name=total-upload parent=global packet-mark=wan-upload max-limit=20M queue=pcq-upload
\`\`\`

Set \`max-limit\` to your actual ISP connection speed (100M down / 20M up in this example).

## How PCQ Distributes Bandwidth

With the above setup and 100 Mbps total download:

- 1 active user → gets 100 Mbps
- 2 active users → each gets ~50 Mbps
- 10 active users → each gets ~10 Mbps
- 20 active users → each gets ~5 Mbps

PCQ dynamically adjusts as users start and stop downloading.

## Setting a Per-User Maximum with pcq-rate

If you want each user to have a maximum (even when others are idle):

\`\`\`
/queue type set pcq-download pcq-rate=10M
/queue type set pcq-upload pcq-rate=5M
\`\`\`

Now no single user can exceed 10 Mbps download or 5 Mbps upload, regardless of what others are doing.

## Viewing Queue Statistics

\`\`\`
/queue tree print stats
\`\`\`

## Combining Simple Queue with PCQ

You can combine both approaches:

1. Use a Simple Queue to limit each user to a maximum (e.g., 20 Mbps).
2. Use PCQ inside that limit to distribute fairly when multiple users are active.

This requires Queue Trees with PCQ as the queue type on child queues.

## PCQ vs Simple Queue: When to Use Which

| Situation | Use |
|---|---|
| Fixed limit per user regardless of load | Simple Queue |
| Fair sharing of a total bandwidth pool | PCQ |
| ISP or shared connection with many users | PCQ |
| Per-department limits with fairness within | Queue Tree + PCQ |

## Troubleshooting PCQ

- **All users get low speeds**: Check that \`max-limit\` on the Queue Tree matches your actual ISP speed.
- **Classifier not working**: Make sure you use \`dst-address\` for download and \`src-address\` for upload.
- **Mangle marks not matching**: Check that mangle rules are in \`forward\` chain and referencing the correct WAN interface.

## Summary

- PCQ dynamically divides bandwidth fairly among active users.
- Create PCQ queue types with \`/queue type add kind=pcq\`.
- Use Queue Trees to apply PCQ to a total bandwidth limit.
- Use mangle marks to identify upload and download traffic.
- Set \`pcq-rate\` to cap per-user speed.
- PCQ is ideal for shared connections and ISP-style fairness.
`,
    contentFa: `## تقسیم منصفانه پهنای باند با PCQ

در حالی که Simple Queue به هر IP یک محدودیت ثابت می‌دهد، PCQ پهنای باند را به صورت خودکار و برابر بین کاربران فعال تقسیم می‌کند.

## PCQ چیست؟

PCQ (Per Connection Queue) یک روش صف‌بندی است که ترافیک را بین کاربران فعال به طور مساوی تقسیم می‌کند. اگر ۱۰ کاربر فعال باشند، هر کدام یک‌دهم پهنای باند را می‌گیرند.

## مرحله ۱: ایجاد انواع Queue PCQ

\`\`\`
/queue type add name=pcq-download kind=pcq pcq-classifier=dst-address pcq-rate=0 pcq-limit=50 pcq-total-limit=2000
/queue type add name=pcq-upload kind=pcq pcq-classifier=src-address pcq-rate=0 pcq-limit=50 pcq-total-limit=2000
\`\`\`

برای دانلود: از \`dst-address\` (آدرس مقصد = کاربران LAN) استفاده کنید.
برای آپلود: از \`src-address\` (آدرس منبع = کاربران LAN) استفاده کنید.

## مرحله ۲: علامت‌گذاری ترافیک با Mangle

\`\`\`
/ip firewall mangle add chain=forward in-interface=pppoe-out1 action=mark-packet new-packet-mark=wan-download passthrough=yes
/ip firewall mangle add chain=forward out-interface=pppoe-out1 action=mark-packet new-packet-mark=wan-upload passthrough=yes
\`\`\`

## مرحله ۳: ایجاد Queue Tree

\`\`\`
/queue tree add name=total-download parent=global packet-mark=wan-download max-limit=100M queue=pcq-download
/queue tree add name=total-upload parent=global packet-mark=wan-upload max-limit=20M queue=pcq-upload
\`\`\`

\`max-limit\` را با سرعت واقعی اینترنت خود تنظیم کنید.

## نحوه تقسیم پهنای باند

با ۱۰۰ مگابیت دانلود:
- ۱ کاربر فعال: ۱۰۰ مگابیت
- ۲ کاربر فعال: هر کدام ۵۰ مگابیت
- ۱۰ کاربر فعال: هر کدام ۱۰ مگابیت

## محدودیت حداکثر برای هر کاربر

\`\`\`
/queue type set pcq-download pcq-rate=10M
/queue type set pcq-upload pcq-rate=5M
\`\`\`

## مشاهده آمار

\`\`\`
/queue tree print stats
\`\`\`

## مقایسه PCQ و Simple Queue

| وضعیت | استفاده از |
|---|---|
| محدودیت ثابت برای هر کاربر | Simple Queue |
| تقسیم منصفانه بین کاربران | PCQ |
| اتصال مشترک با کاربران زیاد | PCQ |

## خلاصه

- PCQ پهنای باند را به طور پویا بین کاربران تقسیم می‌کند
- Queue type را با \`/queue type add kind=pcq\` بسازید
- از Queue Tree برای اعمال PCQ بر کل پهنای باند استفاده کنید
- از Mangle برای شناسایی ترافیک آپلود و دانلود استفاده کنید
`,
  },
  'mikrotik-address-list-dynamic': {
    contentEn: `## Address Lists in RouterOS

Address lists are one of the most powerful and flexible features in RouterOS. They let you group IP addresses together and then reference that group in firewall rules, routing policies, or other configurations. This eliminates the need to write repetitive rules for each individual IP.

## What is an Address List?

An address list is simply a named collection of IP addresses, ranges, or subnets. Instead of writing a firewall rule for each address individually, you write one rule that references the list.

## Creating Static Address Lists

### Adding Single IPs

\`\`\`
/ip firewall address-list add list=trusted-admins address=192.168.1.10 comment="Admin workstation"
/ip firewall address-list add list=trusted-admins address=192.168.1.11 comment="Backup admin laptop"
\`\`\`

### Adding Subnets

\`\`\`
/ip firewall address-list add list=internal-networks address=192.168.1.0/24
/ip firewall address-list add list=internal-networks address=192.168.2.0/24
/ip firewall address-list add list=internal-networks address=10.0.0.0/8
\`\`\`

### Adding IP Ranges

\`\`\`
/ip firewall address-list add list=blocked-users address=192.168.1.100-192.168.1.120
\`\`\`

## Viewing Address Lists

\`\`\`
/ip firewall address-list print
\`\`\`

To filter by list name:

\`\`\`
/ip firewall address-list print where list=trusted-admins
\`\`\`

## Using Address Lists in Firewall Rules

Once you have a list, reference it with \`src-address-list\` or \`dst-address-list\` in firewall rules:

\`\`\`
/ip firewall filter add chain=input src-address-list=trusted-admins action=accept comment="Allow admin access"
/ip firewall filter add chain=input src-address-list=blocked-users action=drop comment="Block restricted users"
\`\`\`

### Blocking an Entire List from Internet Access

\`\`\`
/ip firewall filter add chain=forward src-address-list=blocked-users out-interface=pppoe-out1 action=drop comment="Block internet for restricted users"
\`\`\`

## Dynamic Address List Entries

Dynamic entries are added and removed automatically, either by firewall rules or by other RouterOS features. They are identified by a \`D\` flag in the address list.

### Adding Entries Dynamically via Firewall

You can add IPs to an address list dynamically using the \`add-src-to-address-list\` or \`add-dst-to-address-list\` action in firewall rules.

Example — detect port scanners and block them:

\`\`\`
/ip firewall filter add chain=input protocol=tcp psd=21,3s,3,1 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1d comment="Detect port scanners"
/ip firewall filter add chain=input src-address-list=port-scanners action=drop comment="Drop port scanners"
\`\`\`

The first rule adds any IP that triggers the port scan detector to the \`port-scanners\` list for 1 day. The second rule drops all traffic from that list.

### Timeout-Based Dynamic Entries

The \`address-list-timeout\` parameter controls how long a dynamically added entry stays in the list:

- \`address-list-timeout=30m\` — entry expires after 30 minutes.
- \`address-list-timeout=1d\` — entry expires after 1 day.
- \`address-list-timeout=00:00:00\` or \`0\` — entry never expires (permanent dynamic entry).

### Brute Force Protection Example

Block IPs that attempt too many SSH connections:

\`\`\`
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new src-address-list=ssh-blacklist action=drop comment="Drop SSH brute force"
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new src-address-list=ssh-stage3 action=add-src-to-address-list address-list=ssh-blacklist address-list-timeout=10d comment="Stage 3 to blacklist"
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new src-address-list=ssh-stage2 action=add-src-to-address-list address-list=ssh-stage3 address-list-timeout=1m
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new src-address-list=ssh-stage1 action=add-src-to-address-list address-list=ssh-stage2 address-list-timeout=1m
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new action=add-src-to-address-list address-list=ssh-stage1 address-list-timeout=1m
\`\`\`

This creates a staged system: after 3 new SSH connections within 1 minute, the IP is blacklisted for 10 days.

## Removing Entries

Remove a specific static entry:

\`\`\`
/ip firewall address-list remove [find list=blocked-users address=192.168.1.105]
\`\`\`

Remove all entries in a list:

\`\`\`
/ip firewall address-list remove [find list=port-scanners]
\`\`\`

## Address Lists and NAT

You can also use address lists in NAT rules:

\`\`\`
/ip firewall nat add chain=srcnat src-address-list=internal-networks action=masquerade out-interface=pppoe-out1
\`\`\`

This applies NAT masquerade for all subnets in the \`internal-networks\` list.

## Address Lists for Routing

Address lists can feed into routing marks using mangle:

\`\`\`
/ip firewall mangle add chain=prerouting src-address-list=vip-users action=mark-routing new-routing-mark=vip-route
\`\`\`

## Common Use Cases Summary

- **Whitelist**: Allow specific IPs to access management services.
- **Blacklist**: Block known bad IPs or dynamic attackers.
- **Port scanner detection**: Auto-block scanners.
- **Brute force protection**: Stage-based SSH/Winbox brute force blocking.
- **Group NAT**: Apply NAT to multiple subnets via one list.
- **Policy routing**: Route specific users through different WAN links.

## Summary

- Create lists with \`/ip firewall address-list add list=name address=...\`
- Reference lists in firewall rules with \`src-address-list\` or \`dst-address-list\`.
- Add dynamic entries using \`add-src-to-address-list\` action.
- Control lifetime with \`address-list-timeout\`.
- Use lists to simplify complex firewall policies and enable automated security responses.
`,
    contentFa: `## Address List در RouterOS

Address List یکی از قدرتمندترین ویژگی‌های RouterOS است که به شما اجازه می‌دهد آدرس‌های IP را در گروه‌های نامگذاری‌شده جمع کنید و در قوانین فایروال از آن‌ها استفاده کنید.

## ساخت Address List استاتیک

### اضافه کردن IP تکی

\`\`\`
/ip firewall address-list add list=trusted-admins address=192.168.1.10 comment="Admin workstation"
/ip firewall address-list add list=trusted-admins address=192.168.1.11 comment="Backup admin laptop"
\`\`\`

### اضافه کردن زیرشبکه

\`\`\`
/ip firewall address-list add list=internal-networks address=192.168.1.0/24
/ip firewall address-list add list=internal-networks address=192.168.2.0/24
\`\`\`

## مشاهده Address List

\`\`\`
/ip firewall address-list print
\`\`\`

## استفاده از Address List در قوانین فایروال

\`\`\`
/ip firewall filter add chain=input src-address-list=trusted-admins action=accept comment="Allow admin access"
/ip firewall filter add chain=input src-address-list=blocked-users action=drop comment="Block restricted users"
\`\`\`

## ورودی‌های داینامیک

می‌توانید IP‌ها را به صورت خودکار به لیست اضافه کنید:

### مثال: شناسایی port scanner

\`\`\`
/ip firewall filter add chain=input protocol=tcp psd=21,3s,3,1 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1d comment="Detect port scanners"
/ip firewall filter add chain=input src-address-list=port-scanners action=drop comment="Drop port scanners"
\`\`\`

### مثال: محافظت از SSH در برابر Brute Force

\`\`\`
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new src-address-list=ssh-blacklist action=drop comment="Drop SSH brute force"
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new src-address-list=ssh-stage3 action=add-src-to-address-list address-list=ssh-blacklist address-list-timeout=10d comment="Stage 3 to blacklist"
/ip firewall filter add chain=input protocol=tcp dst-port=22 connection-state=new action=add-src-to-address-list address-list=ssh-stage1 address-list-timeout=1m
\`\`\`

## تایم‌اوت برای ورودی‌های داینامیک

- \`address-list-timeout=30m\`: ورودی بعد از ۳۰ دقیقه پاک می‌شود
- \`address-list-timeout=1d\`: ورودی بعد از ۱ روز پاک می‌شود
- \`address-list-timeout=0\`: ورودی دائمی است

## حذف ورودی‌ها

\`\`\`
/ip firewall address-list remove [find list=port-scanners]
\`\`\`

## کاربردهای رایج

- **Whitelist**: اجازه دسترسی به IPs مورد اعتماد
- **Blacklist**: بلاک کردن IPهای مخرب
- **شناسایی port scanner**: بلاک خودکار اسکنرها
- **محافظت از brute force**: بلاک مراحل‌دار SSH
- **NAT گروهی**: اعمال NAT به چندین زیرشبکه

## خلاصه

- لیست‌ها را با \`/ip firewall address-list add\` بسازید
- در قوانین فایروال از \`src-address-list\` یا \`dst-address-list\` استفاده کنید
- با \`add-src-to-address-list\` ورودی‌های داینامیک اضافه کنید
- طول عمر ورودی‌ها را با \`address-list-timeout\` کنترل کنید
`,
  },
  'mikrotik-layer7-protocol-filter': {
    contentEn: `## Layer7 Protocol Filter in MikroTik Firewall

Layer7 protocol matching is a powerful feature in RouterOS that lets you inspect packet payloads and match traffic based on patterns in the data — not just IP addresses and ports. This is useful for blocking specific applications, games, or websites by recognizing their traffic signatures.

## What is Layer7 Matching?

Traditional firewall rules work at Layer 3 (IP) and Layer 4 (TCP/UDP ports). Layer7 goes deeper — it reads the actual content of packets to find patterns. In RouterOS, you define a regex (regular expression) pattern, and the firewall checks packet data against it.

### Where It Lives

\`\`\`
/ip firewall layer7-protocol
\`\`\`

This is where you define your patterns. Then you reference those patterns inside regular firewall filter rules.

## Creating a Layer7 Pattern

\`\`\`
/ip firewall layer7-protocol add name=block-youtube regexp="^.*(youtube\.com|googlevideo\.com).*$"
\`\`\`

This defines a pattern called \`block-youtube\` that matches traffic containing "youtube.com" or "googlevideo.com" in the payload.

### Applying It in a Firewall Rule

\`\`\`
/ip firewall filter add chain=forward layer7-protocol=block-youtube action=drop comment="Block YouTube"
\`\`\`

This rule drops any forwarded traffic that matches the Layer7 pattern.

## Blocking an App by Pattern

Here is an example blocking Telegram:

\`\`\`
/ip firewall layer7-protocol add name=block-telegram regexp="^.*(149\.154\.|91\.108\.).*$"
\`\`\`

This matches Telegram's known IP ranges in packet data. A better approach for IP blocking is address-lists, but Layer7 can catch patterns that IP rules miss.

### Blocking HTTP Host Headers

For plain HTTP traffic, you can match the Host header:

\`\`\`
/ip firewall layer7-protocol add name=block-facebook regexp="^.*(facebook\.com|fbcdn\.net).*$"
\`\`\`

\`\`\`
/ip firewall filter add chain=forward layer7-protocol=block-facebook action=drop comment="Block Facebook HTTP"
\`\`\`

Note: This works only for unencrypted HTTP. HTTPS traffic is encrypted, so the hostname is in the TLS SNI field, not visible as plain text in most cases.

## Using Layer7 with Address Lists

You can combine Layer7 with address lists for smarter rules:

\`\`\`
/ip firewall layer7-protocol add name=detect-torrent regexp="^(\x13BitTorrent protocol|azver\x01$|get /scrape\?info_hash=)"
\`\`\`

\`\`\`
/ip firewall filter add chain=forward layer7-protocol=detect-torrent action=add-src-to-address-list address-list=torrent-users address-list-timeout=1h
/ip firewall filter add chain=forward src-address-list=torrent-users action=drop
\`\`\`

This detects torrent traffic, adds the source IP to a list, then blocks all traffic from that IP for one hour.

## Performance Considerations

Layer7 matching is **expensive** in terms of CPU usage. Here is why:

- RouterOS must inspect the payload of every packet, not just headers
- Regex matching is computationally heavier than simple IP/port checks
- RouterOS checks the first **10 packets** (or first 2KB of data) in a connection by default — if no match is found, it stops checking that connection

### Tips to Minimize Performance Impact

- **Place Layer7 rules after other rules** — use IP/port filtering first to reduce the number of packets reaching Layer7 rules
- **Use connection state matching** — only inspect new connections:

\`\`\`
/ip firewall filter add chain=forward connection-state=new layer7-protocol=block-youtube action=drop
\`\`\`

- **Avoid complex regex** — keep patterns simple and specific
- **Test on low-traffic routers first** — on busy networks, Layer7 can spike CPU to 100%

## Limitations of Layer7

1. **Does not work with encrypted traffic** — HTTPS, QUIC, and most modern apps use encryption, making payload inspection ineffective
2. **Only inspects first packets** — if the signature appears later in the stream, it will be missed
3. **False positives** — broad regex patterns may accidentally block legitimate traffic
4. **Not a replacement for a proper content filter** — for reliable content filtering, use dedicated solutions like DNS-based filtering or a proxy

## Viewing Layer7 Patterns

\`\`\`
/ip firewall layer7-protocol print
\`\`\`

Output example:
\`\`\`
# NAME                     REGEXP
0 block-youtube            ^.*(youtube\.com|googlevideo\.com).*$
1 block-facebook           ^.*(facebook\.com|fbcdn\.net).*$
\`\`\`

## Practical Example: Block Gaming Traffic

\`\`\`
/ip firewall layer7-protocol add name=block-steam regexp="^.*(steampowered\.com|steamcontent\.com).*$"

/ip firewall filter add chain=forward layer7-protocol=block-steam action=drop comment="Block Steam downloads"
\`\`\`

## Summary

- Layer7 lets you match traffic by payload content using regex
- Define patterns under \`/ip firewall layer7-protocol\`
- Reference patterns in firewall filter rules
- Best used for HTTP (unencrypted) traffic detection
- Always place Layer7 rules late in the chain to protect CPU performance
- For modern encrypted apps, DNS filtering is more effective
`,
    contentFa: `## فیلتر پروتکل لایه ۷ در فایروال میکروتیک

فیلتر لایه ۷ (Layer7) یکی از ویژگی‌های پیشرفته RouterOS است که به شما امکان می‌دهد محتوای بسته‌های شبکه را بررسی کنید و بر اساس الگوهای موجود در داده، ترافیک را شناسایی و مسدود کنید.

## لایه ۷ چیست؟

قوانین معمول فایروال روی لایه ۳ (IP) و لایه ۴ (پورت‌های TCP/UDP) کار می‌کنند. لایه ۷ عمیق‌تر می‌رود و محتوای واقعی بسته‌ها را برای یافتن الگو بررسی می‌کند. در RouterOS، شما یک الگوی regex تعریف می‌کنید و فایروال داده‌های بسته را با آن مقایسه می‌کند.

### محل تنظیم

\`\`\`
/ip firewall layer7-protocol
\`\`\`

## ساخت یک الگوی لایه ۷

\`\`\`
/ip firewall layer7-protocol add name=block-youtube regexp="^.*(youtube\.com|googlevideo\.com).*$"
\`\`\`

### اعمال در قانون فایروال

\`\`\`
/ip firewall filter add chain=forward layer7-protocol=block-youtube action=drop comment="Block YouTube"
\`\`\`

## مسدود کردن فیسبوک (HTTP)

\`\`\`
/ip firewall layer7-protocol add name=block-facebook regexp="^.*(facebook\.com|fbcdn\.net).*$"
/ip firewall filter add chain=forward layer7-protocol=block-facebook action=drop
\`\`\`

توجه: این روش فقط برای ترافیک HTTP رمزنگاری‌نشده کار می‌کند. ترافیک HTTPS رمزگذاری شده است.

## ترکیب با لیست آدرس

\`\`\`
/ip firewall layer7-protocol add name=detect-torrent regexp="^(\x13BitTorrent protocol)"
/ip firewall filter add chain=forward layer7-protocol=detect-torrent action=add-src-to-address-list address-list=torrent-users address-list-timeout=1h
/ip firewall filter add chain=forward src-address-list=torrent-users action=drop
\`\`\`

## ملاحظات عملکردی

لایه ۷ از نظر پردازنده **سنگین** است:

- RouterOS باید محتوای هر بسته را بررسی کند
- به‌طور پیش‌فرض فقط **۱۰ بسته اول** هر اتصال را بررسی می‌کند
- روی شبکه‌های پرترافیک می‌تواند CPU را به ۱۰۰٪ برساند

### نکات بهینه‌سازی

- قوانین لایه ۷ را **بعد از** قوانین IP/پورت قرار دهید
- فقط اتصالات جدید را بررسی کنید:

\`\`\`
/ip firewall filter add chain=forward connection-state=new layer7-protocol=block-youtube action=drop
\`\`\`

## محدودیت‌های لایه ۷

- با ترافیک رمزگذاری‌شده (HTTPS) کار نمی‌کند
- فقط بسته‌های اول اتصال را بررسی می‌کند
- ممکن است الگوهای کلی، ترافیک معتبر را هم مسدود کنند
- برای فیلترینگ قابل‌اطمینان، از DNS filtering یا پروکسی استفاده کنید

## نمایش الگوها

\`\`\`
/ip firewall layer7-protocol print
\`\`\`

## خلاصه

- لایه ۷ ترافیک را بر اساس محتوای payload شناسایی می‌کند
- الگوها را زیر \`/ip firewall layer7-protocol\` تعریف کنید
- بهترین کارایی برای ترافیک HTTP رمزنگاری‌نشده است
- قوانین لایه ۷ را در انتهای زنجیره قرار دهید تا CPU کمتر مصرف شود
`,
  },
  'mikrotik-netwatch-monitoring': {
    contentEn: `## Using Netwatch to Monitor Host Availability in MikroTik

Netwatch is a built-in RouterOS tool that continuously monitors whether a host (IP address) is reachable. When a host goes down or comes back up, Netwatch can automatically run scripts — making it perfect for alerting, failover switching, and automated responses.

## What Netwatch Does

Netwatch sends ICMP ping packets to a target IP at a set interval. If the host stops responding, Netwatch triggers an "down" script. When it responds again, it triggers an "up" script.

### Where to Find It

\`\`\`
/tool netwatch
\`\`\`

## Adding a Netwatch Entry

\`\`\`
/tool netwatch add host=8.8.8.8 interval=30s timeout=1s up-script="" down-script="" comment="Monitor Google DNS"
\`\`\`

Parameters:
- \`host\` — IP address to monitor
- \`interval\` — how often to check (e.g., \`30s\`, \`1m\`)
- \`timeout\` — how long to wait for a reply before marking as down
- \`up-script\` — script to run when host comes back up
- \`down-script\` — script to run when host goes down

## Viewing Netwatch Status

\`\`\`
/tool netwatch print
\`\`\`

Example output:
\`\`\`
# HOST       STATUS  SINCE
0 8.8.8.8   up      Jun/29/2026 10:00:05
1 192.168.1.1 down  Jun/29/2026 09:45:12
\`\`\`

## Practical Use Case 1: Failover Trigger

Suppose you have two WAN connections. When the primary WAN gateway goes down, you want to switch to the backup route.

First, set up two default routes:
\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 distance=1 comment="Primary WAN"
/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.1 distance=2 comment="Backup WAN"
\`\`\`

Then add a Netwatch entry to monitor the primary gateway:
\`\`\`
/tool netwatch add host=203.0.113.1 interval=10s timeout=2s   down-script="/ip route set [find comment="Primary WAN"] distance=10"   up-script="/ip route set [find comment="Primary WAN"] distance=1"
\`\`\`

When the primary goes down, its route distance increases to 10, making the backup route (distance=2) the active path. When primary recovers, distance goes back to 1.

## Practical Use Case 2: Send a Log Entry

\`\`\`
/tool netwatch add host=192.168.10.1 interval=60s   down-script="/log warning message="Server 192.168.10.1 is DOWN!""   up-script="/log info message="Server 192.168.10.1 is back UP.""
\`\`\`

This writes to the RouterOS log whenever the server changes state.

## Practical Use Case 3: Disable an Interface on Failure

\`\`\`
/tool netwatch add host=10.0.0.1 interval=20s   down-script="/interface disable ether2"   up-script="/interface enable ether2"
\`\`\`

## Practical Use Case 4: Trigger an Email Alert

If you have email configured (see the email alerts post), you can send a notification:

\`\`\`
/tool netwatch add host=8.8.8.8 interval=30s   down-script="/tool e-mail send to="admin@example.com" subject="WAN DOWN" body="Primary WAN is unreachable!""   up-script="/tool e-mail send to="admin@example.com" subject="WAN UP" body="Primary WAN restored.""
\`\`\`

## Using Scripts Stored Separately

For complex actions, store the logic in a named script and call it from Netwatch:

\`\`\`
/system script add name=wan-failover-down source={
  /ip route set [find comment="Primary WAN"] distance=10
  /log warning message="WAN Failover activated"
}

/tool netwatch add host=203.0.113.1 interval=10s   down-script="/system script run wan-failover-down"
\`\`\`

This keeps your Netwatch entries clean and the logic maintainable.

## Important Notes

- Netwatch uses **ICMP ping** — if a firewall blocks ICMP on the target, Netwatch will incorrectly show the host as down
- The \`timeout\` must be less than \`interval\`
- Scripts run as the **system user** with full RouterOS permissions — be careful with what you put in them
- On RouterOS v7, Netwatch also supports **TCP** checking (not just ICMP):

\`\`\`
/tool netwatch add host=192.168.1.100 port=80 type=tcp-conn interval=30s   down-script="/log warning message="Web server port 80 down""
\`\`\`

## Checking Netwatch History

\`\`\`
/tool netwatch print detail
\`\`\`

This shows extended information including the last check time and status history.

## Summary

- Netwatch monitors host reachability with configurable ping intervals
- Triggers \`up-script\` and \`down-script\` on state changes
- Perfect for failover routing, alerting, and automated responses
- Use TCP checking for service-level monitoring (RouterOS v7)
- Store complex logic in named scripts and call them from Netwatch
`,
    contentFa: `## مانیتورینگ با Netwatch در میکروتیک

Netwatch یک ابزار داخلی RouterOS است که به‌طور مداوم وضعیت دسترسی به یک هاست (آدرس IP) را بررسی می‌کند. وقتی هاستی از دسترس خارج می‌شود یا برمی‌گردد، Netwatch می‌تواند اسکریپت اجرا کند.

## چطور کار می‌کند

Netwatch بسته‌های ICMP ping را به IP هدف ارسال می‌کند. اگر هاست پاسخ ندهد، اسکریپت "down" اجرا می‌شود. وقتی دوباره پاسخ دهد، اسکریپت "up" اجرا می‌شود.

\`\`\`
/tool netwatch
\`\`\`

## افزودن یک ورودی Netwatch

\`\`\`
/tool netwatch add host=8.8.8.8 interval=30s timeout=1s comment="Monitor Google DNS"
\`\`\`

## مشاهده وضعیت

\`\`\`
/tool netwatch print
\`\`\`

## کاربرد عملی ۱: سوئیچ خودکار WAN

برای failover بین دو WAN:

\`\`\`
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 distance=1 comment="Primary WAN"
/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.1 distance=2 comment="Backup WAN"

/tool netwatch add host=203.0.113.1 interval=10s timeout=2s   down-script="/ip route set [find comment="Primary WAN"] distance=10"   up-script="/ip route set [find comment="Primary WAN"] distance=1"
\`\`\`

وقتی WAN اصلی قطع شود، مسیر backup فعال می‌شود.

## کاربرد عملی ۲: ثبت لاگ

\`\`\`
/tool netwatch add host=192.168.10.1 interval=60s   down-script="/log warning message="Server is DOWN!""   up-script="/log info message="Server is UP.""
\`\`\`

## کاربرد عملی ۳: ارسال ایمیل هشدار

\`\`\`
/tool netwatch add host=8.8.8.8 interval=30s   down-script="/tool e-mail send to="admin@example.com" subject="WAN DOWN" body="WAN is unreachable!""
\`\`\`

## استفاده از اسکریپت‌های جداگانه

برای منطق پیچیده‌تر، اسکریپت را جداگانه ذخیره کنید:

\`\`\`
/system script add name=wan-down source={
  /ip route set [find comment="Primary WAN"] distance=10
  /log warning message="Failover activated"
}

/tool netwatch add host=203.0.113.1 interval=10s   down-script="/system script run wan-down"
\`\`\`

## بررسی TCP (RouterOS v7)

در نسخه ۷، می‌توانید پورت TCP را نیز بررسی کنید:

\`\`\`
/tool netwatch add host=192.168.1.100 port=80 type=tcp-conn interval=30s   down-script="/log warning message="Web server down""
\`\`\`

## نکات مهم

- Netwatch از ICMP ping استفاده می‌کند — اگر فایروال مقصد ICMP را مسدود کند، هاست به اشتباه down نشان داده می‌شود
- \`timeout\` باید کمتر از \`interval\` باشد
- اسکریپت‌ها با دسترسی کامل سیستم اجرا می‌شوند

## خلاصه

- Netwatch دسترسی به هاست‌ها را با فاصله زمانی قابل تنظیم بررسی می‌کند
- در تغییر وضعیت، \`up-script\` یا \`down-script\` اجرا می‌کند
- برای failover، هشدار و پاسخ خودکار بسیار مفید است
`,
  },
  'mikrotik-scheduler-scripting': {
    contentEn: `## RouterOS Scripting and the Scheduler

RouterOS has a built-in scripting language and a scheduler that lets you automate repetitive tasks. From simple daily reboots to complex network automation, scripts and the scheduler are essential tools for any MikroTik administrator.

## RouterOS Scripting Basics

RouterOS scripts are sequences of CLI commands. You store them under \`/system script\` and run them manually or on a schedule.

### Creating a Script

\`\`\`
/system script add name=my-first-script source={
  /log info message="Hello from script!"
}
\`\`\`

### Running a Script Manually

\`\`\`
/system script run my-first-script
\`\`\`

### Viewing All Scripts

\`\`\`
/system script print
\`\`\`

## Script Syntax Basics

RouterOS uses its own scripting syntax:

### Variables

\`\`\`
:local myVar "Hello"
:log info $myVar
\`\`\`

### Conditional Logic

\`\`\`
:if ([:ping 8.8.8.8 count=1] = 0) do={
  :log warning "Google DNS unreachable"
} else={
  :log info "Google DNS reachable"
}
\`\`\`

### Loops

\`\`\`
:for i from=1 to=5 do={
  :log info ("Iteration: " . $i)
}
\`\`\`

### String Concatenation

\`\`\`
:local ip "192.168.1.1"
:log info ("Gateway is: " . $ip)
\`\`\`

## Practical Script Examples

### Example 1: Daily Backup

\`\`\`
/system script add name=daily-backup source={
  /system backup save name=("backup-" . [:pick [/system clock get date] 0 10])
  :log info "Backup completed"
}
\`\`\`

This creates a backup file named with today's date.

### Example 2: Clear DNS Cache

\`\`\`
/system script add name=clear-dns source={
  /ip dns cache flush
  :log info "DNS cache cleared"
}
\`\`\`

### Example 3: Restart a Specific Interface

\`\`\`
/system script add name=restart-ether1 source={
  /interface disable ether1
  :delay 3s
  /interface enable ether1
  :log info "ether1 restarted"
}
\`\`\`

### Example 4: Block an IP Address

\`\`\`
/system script add name=block-suspicious source={
  /ip firewall address-list add list=blocked address=10.0.0.99 timeout=1h
  :log warning "Blocked 10.0.0.99 for 1 hour"
}
\`\`\`

## The Scheduler

The scheduler runs scripts at defined times or intervals automatically.

\`\`\`
/system scheduler
\`\`\`

### Adding a Scheduled Task

\`\`\`
/system scheduler add name=daily-reboot interval=1d start-time=03:00:00   on-event="/system reboot" comment="Reboot at 3am daily"
\`\`\`

Parameters:
- \`name\` — identifier for the task
- \`interval\` — how often to run (\`1d\` = daily, \`1h\` = hourly, \`00:05:00\` = every 5 minutes)
- \`start-time\` — time of day to first run
- \`start-date\` — optional specific start date
- \`on-event\` — the command or script to run

### Schedule a Stored Script

\`\`\`
/system scheduler add name=run-backup interval=1d start-time=02:00:00   on-event="/system script run daily-backup"
\`\`\`

### Schedule Every 5 Minutes

\`\`\`
/system scheduler add name=check-dns interval=00:05:00   on-event="/system script run clear-dns"
\`\`\`

### Schedule a One-Time Task

\`\`\`
/system scheduler add name=one-time-task start-date=2026/07/01 start-time=10:00:00   interval=0 on-event="/system script run my-first-script"
\`\`\`

Setting \`interval=0\` means it runs once and stops.

### Viewing the Schedule

\`\`\`
/system scheduler print
\`\`\`

Example output:
\`\`\`
# NAME          START-DATE   START-TIME INTERVAL  ON-EVENT
0 daily-reboot  jan/01/1970  03:00:00   1d        /system reboot
1 run-backup    jan/01/1970  02:00:00   1d        /system script run daily-backup
\`\`\`

## Useful Built-in Functions

### Get Current Time

\`\`\`
:local now [/system clock get time]
:log info ("Current time: " . $now)
\`\`\`

### Get Interface Status

\`\`\`
:local status [/interface get ether1 running]
:if ($status = true) do={ :log info "ether1 is up" }
\`\`\`

### Find and Modify Objects

\`\`\`
/ip route set [find dst-address="0.0.0.0/0" comment="Primary WAN"] distance=10
\`\`\`

The \`[find ...]\` construct lets you select objects by property and pass them to another command.

## Debugging Scripts

Use \`:put\` to print values during testing in the terminal:

\`\`\`
:local x 42
:put $x
\`\`\`

Use \`/system script run\` in the terminal to test scripts before scheduling them.

## Security Considerations

- Scripts run with **full administrative access** — treat them like root commands
- Avoid storing passwords in scripts when possible
- Use \`/log\` liberally inside scripts so you have an audit trail

## Summary

- Scripts are stored under \`/system script\` and contain RouterOS CLI commands
- The scheduler (\`/system scheduler\`) runs scripts automatically on a time or interval basis
- Use \`:local\`, \`:if\`, \`:for\`, and \`:delay\` for logic and flow control
- Common uses: daily backup, periodic reboots, interface restarts, failover triggers
- Always test scripts manually before scheduling them
`,
    contentFa: `## اسکریپت‌نویسی و زمان‌بند در RouterOS

RouterOS یک زبان اسکریپت داخلی و یک زمان‌بند (Scheduler) دارد که به شما امکان می‌دهد وظایف تکراری را خودکار کنید.

## ایجاد اسکریپت

\`\`\`
/system script add name=my-first-script source={
  /log info message="Hello from script!"
}
\`\`\`

### اجرای دستی اسکریپت

\`\`\`
/system script run my-first-script
\`\`\`

## مبانی سینتکس اسکریپت

### متغیرها

\`\`\`
:local myVar "Hello"
:log info $myVar
\`\`\`

### منطق شرطی

\`\`\`
:if ([:ping 8.8.8.8 count=1] = 0) do={
  :log warning "DNS unreachable"
} else={
  :log info "DNS reachable"
}
\`\`\`

### حلقه

\`\`\`
:for i from=1 to=5 do={
  :log info ("Step: " . $i)
}
\`\`\`

## نمونه‌های عملی

### بکاپ روزانه

\`\`\`
/system script add name=daily-backup source={
  /system backup save name=("backup-" . [:pick [/system clock get date] 0 10])
  :log info "Backup done"
}
\`\`\`

### پاکسازی کش DNS

\`\`\`
/system script add name=clear-dns source={
  /ip dns cache flush
  :log info "DNS cache cleared"
}
\`\`\`

### ریستارت اینترفیس

\`\`\`
/system script add name=restart-ether1 source={
  /interface disable ether1
  :delay 3s
  /interface enable ether1
}
\`\`\`

## زمان‌بند (Scheduler)

\`\`\`
/system scheduler add name=daily-reboot interval=1d start-time=03:00:00   on-event="/system reboot" comment="Reboot at 3am"
\`\`\`

### زمان‌بندی اسکریپت ذخیره‌شده

\`\`\`
/system scheduler add name=run-backup interval=1d start-time=02:00:00   on-event="/system script run daily-backup"
\`\`\`

### هر ۵ دقیقه یک‌بار

\`\`\`
/system scheduler add name=check-dns interval=00:05:00   on-event="/system script run clear-dns"
\`\`\`

### اجرای یک‌باره

\`\`\`
/system scheduler add name=one-time start-date=2026/07/01 start-time=10:00:00   interval=0 on-event="/system script run my-first-script"
\`\`\`

## مشاهده زمان‌بند

\`\`\`
/system scheduler print
\`\`\`

## نکات امنیتی

- اسکریپت‌ها با **دسترسی کامل مدیریتی** اجرا می‌شوند
- از \`/log\` داخل اسکریپت‌ها استفاده کنید تا سابقه داشته باشید
- قبل از زمان‌بندی، اسکریپت را دستی تست کنید

## خلاصه

- اسکریپت‌ها زیر \`/system script\` ذخیره می‌شوند
- زمان‌بند (\`/system scheduler\`) آن‌ها را به‌صورت خودکار اجرا می‌کند
- کاربردها: بکاپ روزانه، ریبوت دوره‌ای، ریستارت اینترفیس، failover
`,
  },
  'mikrotik-email-alerts-setup': {
    contentEn: `## Sending Email Alerts from RouterOS

RouterOS has a built-in email client that can send messages through any SMTP server. Combined with scripts and Netwatch, you can set up automatic email alerts for network events like link failures, high CPU usage, or unauthorized access attempts.

## Configuring the Email Client

All email settings live under:

\`\`\`
/tool e-mail
\`\`\`

### Basic SMTP Configuration

\`\`\`
/tool e-mail set server=smtp.gmail.com port=587   start-tls=yes   from=router@example.com   user=router@example.com   password=your-app-password
\`\`\`

Parameters:
- \`server\` — SMTP server hostname or IP
- \`port\` — typically 587 (STARTTLS) or 465 (SSL) or 25 (plain)
- \`start-tls\` — enable STARTTLS encryption (\`yes\` recommended)
- \`from\` — the sender email address shown to recipients
- \`user\` — SMTP login username (usually the email address)
- \`password\` — SMTP password or app password

### View Current Settings

\`\`\`
/tool e-mail print
\`\`\`

## Using Gmail as SMTP

Gmail requires an **App Password** (not your regular password) when two-factor authentication is enabled.

1. Go to your Google Account → Security → App Passwords
2. Create an app password for "Mail" on "Other device"
3. Use that 16-character password in RouterOS

\`\`\`
/tool e-mail set server=smtp.gmail.com port=587   start-tls=yes   from=youraddress@gmail.com   user=youraddress@gmail.com   password=abcd1234efgh5678
\`\`\`

## Sending a Test Email

\`\`\`
/tool e-mail send to="admin@example.com" subject="Test from MikroTik" body="This is a test email."
\`\`\`

Wait a few seconds and check your inbox. If it does not arrive, check \`/log\` for errors:

\`\`\`
/log print where topics~"e-mail"
\`\`\`

## Triggering Alerts from Scripts

### Alert When a Script Runs

\`\`\`
/system script add name=send-alert source={
  /tool e-mail send     to="admin@example.com"     subject="MikroTik Alert"     body="An important event occurred on the router."
}
\`\`\`

### High CPU Alert

Combine with the scheduler to check CPU usage periodically:

\`\`\`
/system script add name=cpu-alert source={
  :local cpu [/system resource get cpu-load]
  :if ($cpu > 80) do={
    /tool e-mail send       to="admin@example.com"       subject="High CPU Alert"       body=("CPU load is: " . $cpu . "%")
  }
}

/system scheduler add name=cpu-check interval=5m   on-event="/system script run cpu-alert"
\`\`\`

### Interface Down Alert

\`\`\`
/system script add name=ether1-down-alert source={
  /tool e-mail send     to="admin@example.com"     subject="Interface Down"     body="ether1 has gone down on the router!"
}
\`\`\`

Use this with Netwatch or an interface monitoring script.

## Triggering Email from Netwatch

\`\`\`
/tool netwatch add host=8.8.8.8 interval=30s timeout=2s   down-script="/tool e-mail send to="admin@example.com" subject="WAN DOWN" body="Primary WAN is unreachable!""   up-script="/tool e-mail send to="admin@example.com" subject="WAN UP" body="Primary WAN is back online.""
\`\`\`

Note the escaped quotes (\`"\`) inside the netwatch script strings.

## Including System Information in Emails

\`\`\`
/system script add name=status-email source={
  :local cpu [/system resource get cpu-load]
  :local mem [/system resource get free-memory]
  :local uptime [/system resource get uptime]
  :local body ("CPU: " . $cpu . "% | Free Mem: " . $mem . " | Uptime: " . $uptime)
  /tool e-mail send     to="admin@example.com"     subject="Daily Router Status"     body=$body
}

/system scheduler add name=daily-status interval=1d start-time=07:00:00   on-event="/system script run status-email"
\`\`\`

This sends a daily status report every morning.

## Troubleshooting Email

If emails are not sending:

1. **Check the log** for SMTP errors:
\`\`\`
/log print where topics~"e-mail"
\`\`\`

2. **Verify DNS** — the router must be able to resolve smtp.gmail.com:
\`\`\`
/ip dns cache print
:put [:resolve smtp.gmail.com]
\`\`\`

3. **Check firewall** — outbound port 587 or 465 must not be blocked

4. **Try port 25** if 587 fails — some ISPs block non-standard SMTP ports outbound

5. **Use IP instead of hostname** if DNS is the issue:
\`\`\`
/tool e-mail set server=74.125.133.109
\`\`\`

## Security Tips

- Do not store your main email password on the router — use app passwords or a dedicated account
- Consider creating a dedicated "router alerts" Gmail or similar account
- Rotate app passwords periodically
- Limit who can access \`/tool e-mail\` settings via user profiles

## Summary

- Configure SMTP under \`/tool e-mail set\`
- Send emails with \`/tool e-mail send to=... subject=... body=...\`
- Use Gmail with App Passwords for easy setup
- Combine with scripts and Netwatch for automatic event-based alerts
- Check \`/log\` for SMTP errors when troubleshooting
`,
    contentFa: `## ارسال ایمیل هشدار از RouterOS

RouterOS یک کلاینت ایمیل داخلی دارد که می‌تواند از طریق هر سرور SMTP پیام ارسال کند. با ترکیب آن با اسکریپت‌ها و Netwatch، می‌توانید هشدارهای خودکار برای رویدادهای شبکه تنظیم کنید.

## پیکربندی کلاینت ایمیل

\`\`\`
/tool e-mail set server=smtp.gmail.com port=587   start-tls=yes   from=router@example.com   user=router@example.com   password=your-app-password
\`\`\`

### مشاهده تنظیمات فعلی

\`\`\`
/tool e-mail print
\`\`\`

## استفاده از Gmail

Gmail به **App Password** نیاز دارد (نه رمز عبور اصلی):

1. به تنظیمات گوگل بروید → Security → App Passwords
2. یک App Password برای "Mail" بسازید
3. آن رمز ۱۶ کاراکتری را در RouterOS استفاده کنید

\`\`\`
/tool e-mail set server=smtp.gmail.com port=587   start-tls=yes   from=youraddress@gmail.com   user=youraddress@gmail.com   password=abcd1234efgh5678
\`\`\`

## ارسال ایمیل آزمایشی

\`\`\`
/tool e-mail send to="admin@example.com" subject="Test" body="This is a test."
\`\`\`

برای بررسی خطاها:

\`\`\`
/log print where topics~"e-mail"
\`\`\`

## هشدار CPU بالا

\`\`\`
/system script add name=cpu-alert source={
  :local cpu [/system resource get cpu-load]
  :if ($cpu > 80) do={
    /tool e-mail send       to="admin@example.com"       subject="High CPU"       body=("CPU: " . $cpu . "%")
  }
}

/system scheduler add name=cpu-check interval=5m   on-event="/system script run cpu-alert"
\`\`\`

## ایمیل از Netwatch

\`\`\`
/tool netwatch add host=8.8.8.8 interval=30s timeout=2s   down-script="/tool e-mail send to="admin@example.com" subject="WAN DOWN" body="WAN unreachable!""   up-script="/tool e-mail send to="admin@example.com" subject="WAN UP" body="WAN restored.""
\`\`\`

## گزارش وضعیت روزانه

\`\`\`
/system script add name=status-email source={
  :local cpu [/system resource get cpu-load]
  :local uptime [/system resource get uptime]
  :local body ("CPU: " . $cpu . "% | Uptime: " . $uptime)
  /tool e-mail send to="admin@example.com" subject="Daily Status" body=$body
}

/system scheduler add name=daily-status interval=1d start-time=07:00:00   on-event="/system script run status-email"
\`\`\`

## عیب‌یابی

- لاگ را بررسی کنید: \`/log print where topics~"e-mail"\`
- مطمئن شوید DNS کار می‌کند: \`:put [:resolve smtp.gmail.com]\`
- بررسی کنید پورت ۵۸۷ در فایروال مسدود نیست

## خلاصه

- تنظیمات SMTP زیر \`/tool e-mail set\` قرار می‌گیرند
- با \`/tool e-mail send\` ایمیل ارسال کنید
- برای Gmail از App Password استفاده کنید
- با اسکریپت‌ها و Netwatch هشدارهای خودکار بسازید
`,
  },
  'mikrotik-graphing-traffic': {
    contentEn: `## Traffic Graphing with RouterOS Tools

RouterOS includes a built-in graphing tool that generates traffic graphs for interfaces and queues. These graphs help you visualize bandwidth usage over time directly from the router — no external software needed for basic monitoring.

## Enabling the Graphing Tool

\`\`\`
/tool graphing
\`\`\`

This is where you configure what to graph and who can view the graphs.

### Add Interface Graphing

\`\`\`
/tool graphing interface add interface=ether1 store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

Parameters:
- \`interface\` — which interface to graph (use \`all\` for all interfaces)
- \`store-on-disk\` — save historical data to disk
- \`allow-address\` — which IP addresses can view the graphs

### Graph All Interfaces at Once

\`\`\`
/tool graphing interface add interface=all store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

### Add Queue Graphing

\`\`\`
/tool graphing queue add simple-queue=my-queue store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

This graphs the traffic passing through a simple queue.

## Viewing the Graphs

Graphs are accessible through the RouterOS web interface (WebFig):

1. Open a browser and go to \`http://[router-ip]/graphs/\`
2. You will see a list of graphed interfaces and queues
3. Click on any item to view its traffic graph
4. The graph shows traffic in and out over time (minutes, hours, days)

The URL pattern is:
\`\`\`
http://192.168.88.1/graphs/iface/ether1/
http://192.168.88.1/graphs/queue/my-queue/
\`\`\`

## Resource Graphing

You can also graph router resources like CPU and memory:

\`\`\`
/tool graphing resource add store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

View at:
\`\`\`
http://192.168.88.1/graphs/resource/
\`\`\`

This shows CPU load, memory usage, and disk usage over time.

## Configuring Access Control

By default, restrict graphs to your management network:

\`\`\`
/tool graphing interface add interface=all store-on-disk=yes allow-address=192.168.88.0/24
\`\`\`

Only devices on the 192.168.88.0/24 subnet can view the graphs.

## Viewing All Graphing Configurations

\`\`\`
/tool graphing interface print
/tool graphing queue print
/tool graphing resource print
\`\`\`

## Data Retention

RouterOS stores graphing data in three resolutions:
- **5-minute averages** — kept for about 2 days
- **Hourly averages** — kept for about 14 days
- **Daily averages** — kept indefinitely (or until disk runs out)

On routers with limited flash storage, be mindful of enabling \`store-on-disk\` for many interfaces.

## Limitations of Built-in Graphing

The RouterOS graphing tool is useful for quick checks but has limitations:

- No alerting when traffic exceeds thresholds
- Limited customization of graph appearance
- No aggregation across multiple routers
- Graphs are only accessible via web browser

## External Tools: MRTG and Similar

For more advanced monitoring, external tools are commonly used with MikroTik:

### SNMP-Based Monitoring

Enable SNMP on the router:
\`\`\`
/snmp set enabled=yes contact="admin@example.com" location="Server Room"
/snmp community set 0 name=public addresses=192.168.88.0/24
\`\`\`

Then use external tools that poll SNMP:

- **MRTG** (Multi Router Traffic Grapher) — classic, generates HTML traffic graphs
- **Cacti** — web-based, more flexible SNMP graphing
- **Zabbix** — full monitoring platform, includes graphing
- **Grafana + InfluxDB** — modern dashboard with beautiful graphs
- **The Dude** — MikroTik's own free network monitoring tool

### Using The Dude

The Dude is MikroTik's free network monitoring application:

1. Download The Dude from mikrotik.com/thedude
2. Install on a Windows PC or run as a RouterOS package
3. It auto-discovers devices and creates a network map
4. Provides traffic graphs, alerts, and service monitoring

### Enabling The Dude as a RouterOS Package

\`\`\`
/dude set enabled=yes
\`\`\`

Access via \`http://[router-ip]:8080/\` or the Dude desktop client.

## Quick Bandwidth Check via CLI

For a quick real-time bandwidth reading without graphs:

\`\`\`
/interface monitor-traffic ether1
\`\`\`

Output updates every second showing current Rx/Tx rates.

Or use the torch tool for per-protocol breakdown:

\`\`\`
/tool torch interface=ether1
\`\`\`

## Summary

- Enable interface graphing with \`/tool graphing interface add\`
- View graphs in a browser at \`http://[router-ip]/graphs/\`
- Also graph CPU/memory with \`/tool graphing resource add\`
- Restrict access using \`allow-address\`
- For advanced monitoring, use SNMP with Cacti, Zabbix, or Grafana
- The Dude is MikroTik's own free monitoring tool
- For real-time CLI monitoring, use \`/interface monitor-traffic\`
`,
    contentFa: `## نمودار ترافیک با ابزارهای RouterOS

RouterOS یک ابزار نمودار داخلی دارد که گراف‌های ترافیکی برای اینترفیس‌ها و صف‌ها ایجاد می‌کند. این نمودارها به شما کمک می‌کنند مصرف پهنای باند را در طول زمان مشاهده کنید.

## فعال‌سازی ابزار Graphing

### افزودن نمودار اینترفیس

\`\`\`
/tool graphing interface add interface=ether1 store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

### نمودار تمام اینترفیس‌ها

\`\`\`
/tool graphing interface add interface=all store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

### نمودار صف

\`\`\`
/tool graphing queue add simple-queue=my-queue store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

## مشاهده نمودارها

در مرورگر به آدرس زیر بروید:

\`\`\`
http://192.168.88.1/graphs/
http://192.168.88.1/graphs/iface/ether1/
\`\`\`

## نمودار منابع سیستم

\`\`\`
/tool graphing resource add store-on-disk=yes allow-address=0.0.0.0/0
\`\`\`

آدرس:
\`\`\`
http://192.168.88.1/graphs/resource/
\`\`\`

CPU، حافظه و دیسک را نشان می‌دهد.

## کنترل دسترسی

\`\`\`
/tool graphing interface add interface=all store-on-disk=yes allow-address=192.168.88.0/24
\`\`\`

فقط دستگاه‌های شبکه مدیریت می‌توانند نمودارها را ببینند.

## محدودیت‌های ابزار داخلی

- هشدار برای تجاوز از آستانه ترافیک ندارد
- سفارشی‌سازی محدود
- فقط از طریق مرورگر قابل دسترس است

## ابزارهای خارجی

### فعال‌سازی SNMP

\`\`\`
/snmp set enabled=yes
/snmp community set 0 name=public addresses=192.168.88.0/24
\`\`\`

ابزارهای رایج:

- **Cacti** — نمودار SNMP قابل انعطاف
- **Zabbix** — پلتفرم مانیتورینگ کامل
- **Grafana + InfluxDB** — داشبورد مدرن
- **The Dude** — ابزار رایگان خود میکروتیک

### The Dude

\`\`\`
/dude set enabled=yes
\`\`\`

دسترسی: \`http://[router-ip]:8080/\`

## بررسی سریع پهنای باند در CLI

\`\`\`
/interface monitor-traffic ether1
\`\`\`

یا برای تفکیک بر اساس پروتکل:

\`\`\`
/tool torch interface=ether1
\`\`\`

## خلاصه

- نمودار اینترفیس را با \`/tool graphing interface add\` فعال کنید
- نمودارها را در \`http://[router-ip]/graphs/\` ببینید
- برای مانیتورینگ پیشرفته از SNMP با Cacti یا Zabbix استفاده کنید
- The Dude ابزار رایگان میکروتیک برای مانیتورینگ شبکه است
`,
  },
  'mikrotik-capsman-wifi-central': {
    contentEn: `## Centralized Wireless Management with CAPsMAN

CAPsMAN (Controlled Access Point System Manager) is MikroTik's solution for managing multiple wireless access points from a single central controller. Instead of configuring each AP individually, you configure everything on the controller and push settings to all APs automatically.

## How CAPsMAN Works

- **CAPsMAN Controller** — a MikroTik router or device running the CAPsMAN manager. This is where all wireless configuration lives.
- **CAP (Controlled Access Point)** — a MikroTik wireless device that connects to the controller and receives its configuration. The CAP itself has no local wireless config.
- Communication between CAP and controller uses the MNDP/discovery protocol over Layer 2 (same network) or can be tunneled over IP.

## Benefits Over Standalone AP Configuration

- Change SSID, password, or security settings once — all APs update automatically
- Central visibility of all connected clients across all APs
- Seamless roaming (clients can move between APs without reconnecting)
- Easier firmware updates across all APs
- Consistent configuration — no risk of misconfigured individual APs

## Setting Up the CAPsMAN Controller

Run these commands on your main MikroTik router (the controller):

### Step 1: Enable the CAPsMAN Package

On RouterOS v7, CAPsMAN is built in. Just enable it:

\`\`\`
/caps-man manager set enabled=yes
\`\`\`

Verify it is running:

\`\`\`
/caps-man manager print
\`\`\`

### Step 2: Create a Security Profile

\`\`\`
/caps-man security add name=sec-wpa2   authentication-types=wpa2-psk   passphrase=YourWiFiPassword123
\`\`\`

### Step 3: Create a Channel Configuration

\`\`\`
/caps-man channel add name=ch-2g band=2ghz-b/g/n frequency=2437 width=20mhz
\`\`\`

For 5GHz:
\`\`\`
/caps-man channel add name=ch-5g band=5ghz-a/n/ac frequency=5180 width=80mhz
\`\`\`

### Step 4: Create a Datapath

The datapath controls how wireless traffic is forwarded:

\`\`\`
/caps-man datapath add name=dp-local local-forwarding=yes
\`\`\`

\`local-forwarding=yes\` means clients' traffic is forwarded locally on the CAP (better performance, no tunnel to controller needed).

### Step 5: Create a Configuration Profile

\`\`\`
/caps-man configuration add name=cfg-home   ssid=MyHomeNetwork   security=sec-wpa2   channel=ch-2g   datapath=dp-local   mode=ap
\`\`\`

### Step 6: Create Provisioning Rules

Provisioning rules tell CAPsMAN which configuration to assign to each CAP when it connects:

\`\`\`
/caps-man provisioning add action=create-dynamic-enabled master-configuration=cfg-home
\`\`\`

This applies \`cfg-home\` to any CAP that connects to this controller.

### Step 7: View Connected CAPs

\`\`\`
/caps-man remote-cap print
\`\`\`

## Setting Up a CAP Device

Run these on each access point that will be managed by CAPsMAN:

### Step 1: Enable CAP Mode

\`\`\`
/interface wireless cap set enabled=yes   interfaces=wlan1   discovery-interfaces=ether1   caps-man-addresses=192.168.88.1
\`\`\`

Parameters:
- \`interfaces\` — the wireless interface to put under CAPsMAN control
- \`discovery-interfaces\` — which interface to use to find the controller
- \`caps-man-addresses\` — IP of the controller (leave empty for auto-discovery on same L2)

### Step 2: Verify the CAP is Connected

On the controller:
\`\`\`
/caps-man remote-cap print
\`\`\`

You should see the CAP listed with status \`running\`.

## Multiple SSIDs with CAPsMAN

Create multiple configuration profiles and use virtual interfaces:

\`\`\`
/caps-man configuration add name=cfg-guest   ssid=GuestNetwork   security=sec-guest   datapath=dp-guest   mode=ap

/caps-man provisioning add action=create-dynamic-enabled   master-configuration=cfg-home   slave-configurations=cfg-guest
\`\`\`

This creates two SSIDs on each CAP — main network and guest network.

## Viewing Connected Wireless Clients

On the controller, see all clients across all APs:

\`\`\`
/caps-man registration-table print
\`\`\`

## CAPsMAN vs Standalone — When to Use Which

| Situation | Recommendation |
|-----------|----------------|
| Single AP at home | Standalone (simpler) |
| 2-3 APs in a home | Either works, CAPsMAN helps with consistency |
| Office with 5+ APs | CAPsMAN strongly recommended |
| Different VLANs per SSID | CAPsMAN (easier to manage) |
| Seamless roaming needed | CAPsMAN required |

## Troubleshooting

If a CAP is not connecting to the controller:

1. Check that both are on the same Layer 2 network, or set \`caps-man-addresses\` explicitly
2. Verify the CAPsMAN manager is enabled: \`/caps-man manager print\`
3. Check for firewall rules blocking UDP 5246 (CAPsMAN control port)
4. Confirm the wireless package is installed on the CAP

## Summary

- CAPsMAN centralizes wireless management for multiple APs
- Controller runs \`/caps-man manager set enabled=yes\`
- Define security, channel, datapath, and configuration profiles on the controller
- Provisioning rules auto-assign configurations to connecting CAPs
- CAPs run \`/interface wireless cap set enabled=yes\`
- View all APs and clients from the controller with \`/caps-man remote-cap print\`
`,
    contentFa: `## مدیریت متمرکز وایرلس با CAPsMAN

CAPsMAN (Controlled Access Point System Manager) راه‌حل میکروتیک برای مدیریت چندین اکسس‌پوینت از یک کنترلر مرکزی است.

## نحوه کار

- **کنترلر CAPsMAN** — روتر یا دستگاه میکروتیکی که تمام پیکربندی وایرلس روی آن قرار دارد
- **CAP** — دستگاه وایرلس میکروتیکی که به کنترلر متصل می‌شود و تنظیمات را از آن دریافت می‌کند

## مزایا نسبت به پیکربندی مستقل

- تغییر SSID یا رمز عبور یک‌بار برای همه AP‌ها
- دید مرکزی از تمام کلاینت‌های متصل
- رومینگ بدون قطع اتصال
- به‌روزرسانی فریم‌ور یکجا برای همه AP‌ها

## راه‌اندازی کنترلر CAPsMAN

### مرحله ۱: فعال‌سازی CAPsMAN

\`\`\`
/caps-man manager set enabled=yes
\`\`\`

### مرحله ۲: پروفایل امنیتی

\`\`\`
/caps-man security add name=sec-wpa2   authentication-types=wpa2-psk   passphrase=YourWiFiPassword123
\`\`\`

### مرحله ۳: پیکربندی کانال

\`\`\`
/caps-man channel add name=ch-2g band=2ghz-b/g/n frequency=2437 width=20mhz
\`\`\`

### مرحله ۴: Datapath

\`\`\`
/caps-man datapath add name=dp-local local-forwarding=yes
\`\`\`

### مرحله ۵: پروفایل پیکربندی

\`\`\`
/caps-man configuration add name=cfg-home   ssid=MyHomeNetwork   security=sec-wpa2   channel=ch-2g   datapath=dp-local   mode=ap
\`\`\`

### مرحله ۶: قوانین Provisioning

\`\`\`
/caps-man provisioning add action=create-dynamic-enabled master-configuration=cfg-home
\`\`\`

### مرحله ۷: مشاهده CAP‌های متصل

\`\`\`
/caps-man remote-cap print
\`\`\`

## راه‌اندازی دستگاه CAP

روی هر اکسس‌پوینت:

\`\`\`
/interface wireless cap set enabled=yes   interfaces=wlan1   discovery-interfaces=ether1   caps-man-addresses=192.168.88.1
\`\`\`

## مشاهده کلاینت‌های متصل

\`\`\`
/caps-man registration-table print
\`\`\`

## عیب‌یابی

اگر CAP به کنترلر متصل نشد:
- بررسی کنید هر دو روی یک شبکه Layer 2 هستند
- CAPsMAN manager فعال باشد: \`/caps-man manager print\`
- پورت UDP 5246 در فایروال مسدود نباشد

## خلاصه

- CAPsMAN مدیریت وایرلس چندین AP را متمرکز می‌کند
- کنترلر با \`/caps-man manager set enabled=yes\` فعال می‌شود
- پروفایل‌های امنیت، کانال و پیکربندی روی کنترلر تعریف می‌شوند
- CAP‌ها با \`/interface wireless cap set enabled=yes\` فعال می‌شوند
`,
  },
  'mikrotik-vlan-trunk-access': {
    contentEn: `## VLANs on MikroTik: Trunk and Access Ports

VLANs (Virtual Local Area Networks) let you segment a single physical network into multiple isolated logical networks. This is essential for separating office departments, guest networks, IoT devices, and management traffic.

## VLAN Basics

- **VLAN ID (VID)** — a number (1–4094) that tags traffic as belonging to a specific VLAN
- **Tagged port (trunk)** — carries traffic for multiple VLANs, each packet has a VLAN tag
- **Untagged port (access)** — connects to end devices (PCs, printers), traffic for one VLAN only, no tag added
- **Trunk link** — a connection between switches (or switch and router) carrying multiple VLANs

## VLAN Implementation on MikroTik (Bridge Method)

Modern MikroTik devices (RouterOS v7) use the **bridge VLAN filtering** method, which is the recommended approach.

### Topology Example

\`\`\`
Internet
   |
[MikroTik Router]
   |
 ether1 (WAN)
 ether2 (trunk to switch/other devices)
 ether3 (access port — VLAN 10, Office)
 ether4 (access port — VLAN 20, Guest)
\`\`\`

We will set up:
- VLAN 10: Office network (192.168.10.0/24)
- VLAN 20: Guest network (192.168.20.0/24)

### Step 1: Create a Bridge

\`\`\`
/interface bridge add name=br-main vlan-filtering=no
\`\`\`

We start with \`vlan-filtering=no\` — enable it at the end to avoid locking yourself out.

### Step 2: Add Ports to the Bridge

\`\`\`
/interface bridge port add bridge=br-main interface=ether2
/interface bridge port add bridge=br-main interface=ether3
/interface bridge port add bridge=br-main interface=ether4
\`\`\`

### Step 3: Configure VLAN Membership

Set ether2 as a trunk (tagged for VLANs 10 and 20):
\`\`\`
/interface bridge vlan add bridge=br-main vlan-ids=10 tagged=ether2
/interface bridge vlan add bridge=br-main vlan-ids=20 tagged=ether2
\`\`\`

Set ether3 as access for VLAN 10 (untagged):
\`\`\`
/interface bridge vlan set [find vlan-ids=10] untagged=ether3
\`\`\`

Set ether4 as access for VLAN 20 (untagged):
\`\`\`
/interface bridge vlan set [find vlan-ids=20] untagged=ether4
\`\`\`

### Step 4: Set PVID on Access Ports

PVID is the default VLAN assigned to untagged incoming traffic on a port:

\`\`\`
/interface bridge port set [find interface=ether3] pvid=10
/interface bridge port set [find interface=ether4] pvid=20
\`\`\`

### Step 5: Create VLAN Interfaces on the Bridge

These are used for routing between VLANs and assigning IP addresses:

\`\`\`
/interface vlan add name=vlan10 vlan-id=10 interface=br-main
/interface vlan add name=vlan20 vlan-id=20 interface=br-main
\`\`\`

### Step 6: Assign IP Addresses

\`\`\`
/ip address add address=192.168.10.1/24 interface=vlan10
/ip address add address=192.168.20.1/24 interface=vlan20
\`\`\`

### Step 7: Set Up DHCP for Each VLAN

\`\`\`
/ip pool add name=pool10 ranges=192.168.10.10-192.168.10.254
/ip pool add name=pool20 ranges=192.168.20.10-192.168.20.254

/ip dhcp-server add name=dhcp10 interface=vlan10 address-pool=pool10
/ip dhcp-server add name=dhcp20 interface=vlan20 address-pool=pool20

/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=8.8.8.8
/ip dhcp-server network add address=192.168.20.0/24 gateway=192.168.20.1 dns-server=8.8.8.8
\`\`\`

### Step 8: Enable VLAN Filtering on the Bridge

\`\`\`
/interface bridge set br-main vlan-filtering=yes
\`\`\`

This activates VLAN enforcement. Do this last — after all VLAN settings are in place — to avoid losing access to the router.

## Firewall Rules Between VLANs

By default, traffic can route between VLANs through the router. To isolate the guest network:

\`\`\`
/ip firewall filter add chain=forward in-interface=vlan20 out-interface=vlan10 action=drop comment="Block Guest to Office"
/ip firewall filter add chain=forward in-interface=vlan20 out-interface=vlan20 action=accept
/ip firewall filter add chain=forward in-interface=vlan20 action=accept out-interface=!vlan10
\`\`\`

Or simpler — block guest to all internal:
\`\`\`
/ip firewall filter add chain=forward in-interface=vlan20 dst-address=192.168.10.0/24 action=drop
\`\`\`

## Verifying VLAN Configuration

\`\`\`
/interface bridge vlan print
\`\`\`

Output:
\`\`\`
# BRIDGE   VLAN-IDS  CURRENT-TAGGED  CURRENT-UNTAGGED
0 br-main  10        ether2          ether3
1 br-main  20        ether2          ether4
\`\`\`

## Classic VLAN Interface Method (Alternative)

On older setups or for simpler use cases, you can create VLAN interfaces directly on physical interfaces:

\`\`\`
/interface vlan add name=vlan10-on-ether2 vlan-id=10 interface=ether2
/ip address add address=192.168.10.1/24 interface=vlan10-on-ether2
\`\`\`

This works but the bridge method is preferred for modern deployments.

## Summary

- VLANs segment your network into isolated logical groups
- Use bridge VLAN filtering in RouterOS v7 for proper VLAN support
- Tagged ports (trunks) carry multiple VLANs; untagged ports (access) carry one
- Create VLAN interfaces on the bridge for routing and DHCP
- Always enable \`vlan-filtering=yes\` last to avoid losing router access
- Use firewall rules to control inter-VLAN traffic
`,
    contentFa: `## VLAN در میکروتیک: پورت‌های Trunk و Access

VLAN (شبکه محلی مجازی) به شما امکان می‌دهد یک شبکه فیزیکی را به چندین شبکه منطقی مجزا تقسیم کنید.

## مفاهیم اساسی

- **VLAN ID** — عددی (۱ تا ۴۰۹۴) که ترافیک را برچسب‌گذاری می‌کند
- **پورت Tagged (trunk)** — ترافیک چندین VLAN را حمل می‌کند
- **پورت Untagged (access)** — به دستگاه‌های نهایی متصل می‌شود، فقط یک VLAN

## پیاده‌سازی VLAN با Bridge (روش توصیه‌شده در RouterOS v7)

### توپولوژی مثال

- VLAN 10: شبکه اداری (192.168.10.0/24)
- VLAN 20: شبکه مهمان (192.168.20.0/24)
- ether2: تراکنک (tagged برای هر دو VLAN)
- ether3: access برای VLAN 10
- ether4: access برای VLAN 20

### مرحله ۱: ایجاد Bridge

\`\`\`
/interface bridge add name=br-main vlan-filtering=no
\`\`\`

### مرحله ۲: افزودن پورت‌ها به Bridge

\`\`\`
/interface bridge port add bridge=br-main interface=ether2
/interface bridge port add bridge=br-main interface=ether3
/interface bridge port add bridge=br-main interface=ether4
\`\`\`

### مرحله ۳: تنظیم عضویت VLAN

\`\`\`
/interface bridge vlan add bridge=br-main vlan-ids=10 tagged=ether2
/interface bridge vlan add bridge=br-main vlan-ids=20 tagged=ether2
/interface bridge vlan set [find vlan-ids=10] untagged=ether3
/interface bridge vlan set [find vlan-ids=20] untagged=ether4
\`\`\`

### مرحله ۴: تنظیم PVID

\`\`\`
/interface bridge port set [find interface=ether3] pvid=10
/interface bridge port set [find interface=ether4] pvid=20
\`\`\`

### مرحله ۵: ایجاد اینترفیس‌های VLAN

\`\`\`
/interface vlan add name=vlan10 vlan-id=10 interface=br-main
/interface vlan add name=vlan20 vlan-id=20 interface=br-main
\`\`\`

### مرحله ۶: آدرس IP

\`\`\`
/ip address add address=192.168.10.1/24 interface=vlan10
/ip address add address=192.168.20.1/24 interface=vlan20
\`\`\`

### مرحله ۷: DHCP

\`\`\`
/ip pool add name=pool10 ranges=192.168.10.10-192.168.10.254
/ip dhcp-server add name=dhcp10 interface=vlan10 address-pool=pool10
/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1
\`\`\`

### مرحله ۸: فعال‌سازی VLAN Filtering (آخرین مرحله)

\`\`\`
/interface bridge set br-main vlan-filtering=yes
\`\`\`

## جداسازی ترافیک بین VLAN‌ها

\`\`\`
/ip firewall filter add chain=forward in-interface=vlan20 dst-address=192.168.10.0/24 action=drop
\`\`\`

## بررسی پیکربندی

\`\`\`
/interface bridge vlan print
\`\`\`

## خلاصه

- VLAN شبکه را به بخش‌های منطقی مجزا تقسیم می‌کند
- از Bridge VLAN Filtering در RouterOS v7 استفاده کنید
- پورت‌های Tagged چندین VLAN را حمل می‌کنند؛ پورت‌های Untagged یک VLAN
- \`vlan-filtering=yes\` را **آخر** فعال کنید
`,
  },
  'mikrotik-ipsec-ikev2-setup': {
    contentEn: `## Basic IPsec IKEv2 VPN Setup on MikroTik

IPsec (Internet Protocol Security) is a standard for encrypting and authenticating IP traffic. IKEv2 is the modern key exchange protocol used with IPsec — it is faster, more secure, and more reliable than the older IKEv1. This guide covers a simple setup for beginners.

## IPsec Concepts (Simplified)

- **Phase 1 (IKE SA)** — the two routers authenticate each other and agree on encryption parameters. Configured via "peers" and "proposals."
- **Phase 2 (IPsec SA)** — the actual data tunnel is established. Configured via "policies."
- **Pre-shared Key (PSK)** — a shared password used to authenticate both sides (simplest method for beginners)
- **Proposal** — the set of encryption algorithms to use (e.g., AES-256, SHA-256)

## Scenario: Site-to-Site IKEv2 VPN

We will connect two offices:

- **Site A (Router A):** WAN IP 203.0.113.1, LAN 192.168.1.0/24
- **Site B (Router B):** WAN IP 198.51.100.1, LAN 192.168.2.0/24

Goal: devices on both LANs can communicate securely through the VPN.

## Configuration on Router A

### Step 1: Create an IPsec Proposal

\`\`\`
/ip ipsec proposal add name=prop-ikev2   auth-algorithms=sha256   enc-algorithms=aes-256-cbc   lifetime=1h   pfs-group=modp2048
\`\`\`

### Step 2: Create a Peer

\`\`\`
/ip ipsec peer add name=site-b-peer   address=198.51.100.1   exchange-mode=ike2   profile=default
\`\`\`

### Step 3: Create an Identity (Pre-Shared Key)

\`\`\`
/ip ipsec identity add peer=site-b-peer   auth-method=pre-shared-key   secret=MyStrongSharedKey123!
\`\`\`

### Step 4: Create a Policy

The policy defines which traffic should be encrypted:

\`\`\`
/ip ipsec policy add src-address=192.168.1.0/24   dst-address=192.168.2.0/24   peer=site-b-peer   proposal=prop-ikev2   action=encrypt   tunnel=yes
\`\`\`

### Step 5: Disable NAT for VPN Traffic

Add a NAT bypass rule so VPN traffic is not masqueraded:

\`\`\`
/ip firewall nat add chain=srcnat src-address=192.168.1.0/24   dst-address=192.168.2.0/24 action=accept place-before=0
\`\`\`

This rule must be placed **before** the masquerade rule.

## Configuration on Router B

Mirror the configuration with reversed addresses:

### Proposal (same as Router A)

\`\`\`
/ip ipsec proposal add name=prop-ikev2   auth-algorithms=sha256   enc-algorithms=aes-256-cbc   lifetime=1h   pfs-group=modp2048
\`\`\`

### Peer

\`\`\`
/ip ipsec peer add name=site-a-peer   address=203.0.113.1   exchange-mode=ike2   profile=default
\`\`\`

### Identity

\`\`\`
/ip ipsec identity add peer=site-a-peer   auth-method=pre-shared-key   secret=MyStrongSharedKey123!
\`\`\`

### Policy (reversed src/dst)

\`\`\`
/ip ipsec policy add src-address=192.168.2.0/24   dst-address=192.168.1.0/24   peer=site-a-peer   proposal=prop-ikev2   action=encrypt   tunnel=yes
\`\`\`

### NAT Bypass

\`\`\`
/ip firewall nat add chain=srcnat src-address=192.168.2.0/24   dst-address=192.168.1.0/24 action=accept place-before=0
\`\`\`

## Verifying the IPsec Tunnel

### Check Active SAs (Security Associations)

\`\`\`
/ip ipsec active-peers print
\`\`\`

You should see the peer with status \`established\`.

### Check Installed Policies

\`\`\`
/ip ipsec policy print
\`\`\`

Look for \`ph2-count: 1\` which means Phase 2 is established.

### Check Statistics

\`\`\`
/ip ipsec statistics print
\`\`\`

Shows packets encrypted/decrypted — if these counters increase when you ping across the tunnel, it is working.

## Testing the Tunnel

From a device on Site A's LAN (192.168.1.x), ping a device on Site B:

\`\`\`
ping 192.168.2.1
\`\`\`

If it works, the tunnel is up. If not, check:

\`\`\`
/log print where topics~"ipsec"
\`\`\`

## IPsec Profile Configuration

The \`default\` profile works for most setups, but you can customize:

\`\`\`
/ip ipsec profile add name=ikev2-profile   dh-group=modp2048   enc-algorithm=aes-256   hash-algorithm=sha256   lifetime=8h   nat-traversal=yes
\`\`\`

Enable \`nat-traversal=yes\` if either router is behind NAT.

## Firewall for IPsec

Make sure these ports/protocols are allowed on the WAN interface:

\`\`\`
/ip firewall filter add chain=input protocol=udp dst-port=500 action=accept comment="IKE"
/ip firewall filter add chain=input protocol=udp dst-port=4500 action=accept comment="IPsec NAT-T"
/ip firewall filter add chain=input protocol=ipsec-esp action=accept comment="IPsec ESP"
\`\`\`

## Summary

- IPsec IKEv2 provides encrypted tunnels between sites
- Configure: proposal → peer → identity → policy on each router
- Src/dst addresses in policies are reversed on each end
- Add NAT bypass before the masquerade rule
- Verify with \`/ip ipsec active-peers print\`
- Use \`nat-traversal=yes\` if behind NAT
- Check logs with \`/log print where topics~"ipsec"\` for troubleshooting
`,
    contentFa: `## راه‌اندازی VPN IPsec IKEv2 در میکروتیک

IPsec یک استاندارد برای رمزگذاری و احراز هویت ترافیک IP است. IKEv2 پروتکل مدرن تبادل کلید است که سریع‌تر و امن‌تر از IKEv1 می‌باشد.

## مفاهیم اساسی

- **فاز ۱ (IKE SA)** — دو روتر یکدیگر را احراز هویت می‌کنند
- **فاز ۲ (IPsec SA)** — تونل داده واقعی برقرار می‌شود
- **Pre-shared Key (PSK)** — رمز مشترک برای احراز هویت

## سناریو: VPN Site-to-Site

- **سایت A:** WAN 203.0.113.1، LAN 192.168.1.0/24
- **سایت B:** WAN 198.51.100.1، LAN 192.168.2.0/24

## پیکربندی روتر A

### مرحله ۱: Proposal

\`\`\`
/ip ipsec proposal add name=prop-ikev2   auth-algorithms=sha256   enc-algorithms=aes-256-cbc   lifetime=1h   pfs-group=modp2048
\`\`\`

### مرحله ۲: Peer

\`\`\`
/ip ipsec peer add name=site-b-peer   address=198.51.100.1   exchange-mode=ike2   profile=default
\`\`\`

### مرحله ۳: Identity (کلید مشترک)

\`\`\`
/ip ipsec identity add peer=site-b-peer   auth-method=pre-shared-key   secret=MyStrongSharedKey123!
\`\`\`

### مرحله ۴: Policy

\`\`\`
/ip ipsec policy add src-address=192.168.1.0/24   dst-address=192.168.2.0/24   peer=site-b-peer   proposal=prop-ikev2   action=encrypt   tunnel=yes
\`\`\`

### مرحله ۵: غیرفعال‌سازی NAT برای ترافیک VPN

\`\`\`
/ip firewall nat add chain=srcnat src-address=192.168.1.0/24   dst-address=192.168.2.0/24 action=accept place-before=0
\`\`\`

## پیکربندی روتر B (معکوس)

\`\`\`
/ip ipsec peer add name=site-a-peer address=203.0.113.1 exchange-mode=ike2 profile=default
/ip ipsec identity add peer=site-a-peer auth-method=pre-shared-key secret=MyStrongSharedKey123!
/ip ipsec policy add src-address=192.168.2.0/24 dst-address=192.168.1.0/24   peer=site-a-peer proposal=prop-ikev2 action=encrypt tunnel=yes
/ip firewall nat add chain=srcnat src-address=192.168.2.0/24   dst-address=192.168.1.0/24 action=accept place-before=0
\`\`\`

## بررسی تونل

\`\`\`
/ip ipsec active-peers print
\`\`\`

باید peer را با وضعیت \`established\` ببینید.

\`\`\`
/ip ipsec statistics print
\`\`\`

اگر شمارنده‌های رمزگذاری/رمزگشایی افزایش یابند، تونل کار می‌کند.

## فایروال برای IPsec

\`\`\`
/ip firewall filter add chain=input protocol=udp dst-port=500 action=accept
/ip firewall filter add chain=input protocol=udp dst-port=4500 action=accept
/ip firewall filter add chain=input protocol=ipsec-esp action=accept
\`\`\`

## خلاصه

- IPsec IKEv2 تونل‌های رمزگذاری‌شده بین سایت‌ها ایجاد می‌کند
- پیکربندی: proposal → peer → identity → policy روی هر روتر
- آدرس‌های src/dst در policy‌ها روی هر طرف معکوس می‌شوند
- قبل از قانون masquerade، NAT bypass اضافه کنید
`,
  },
  'mikrotik-pptp-l2tp-vpn-server': {
    contentEn: `## Setting Up PPTP and L2TP VPN Servers on MikroTik

RouterOS supports several VPN protocols for remote access. This guide covers PPTP and L2TP — two older but still commonly used protocols. Understanding both helps you choose the right one and configure it correctly.

## Important Security Note

**PPTP is considered insecure** and should not be used for sensitive data. Its encryption has known vulnerabilities and it is easily blocked by firewalls and ISPs.

**L2TP/IPsec is the recommended choice** — L2TP alone provides no encryption, but when combined with IPsec (which RouterOS does automatically), it becomes a reasonably secure protocol.

Use these protocols when:
- Connecting legacy clients that do not support IKEv2
- Quick remote access for non-critical access
- Compatibility is more important than maximum security

For maximum security, use IKEv2 (see the IPsec IKEv2 guide).

## Part 1: Setting Up the PPTP Server

### Enable the PPTP Server

\`\`\`
/interface pptp-server server set enabled=yes authentication=mschap2   default-profile=default-encryption
\`\`\`

Parameters:
- \`authentication=mschap2\` — use MS-CHAPv2 (most compatible)
- \`default-profile\` — the profile controlling IP, DNS, compression settings

### Create a User Account

VPN users are managed under \`/ppp secret\`:

\`\`\`
/ppp secret add name=vpnuser1 password=SecurePass123   service=pptp   local-address=192.168.100.1   remote-address=192.168.100.10   comment="Remote user 1"
\`\`\`

Parameters:
- \`service=pptp\` — this account is for PPTP only
- \`local-address\` — the IP assigned to the router's end of the tunnel
- \`remote-address\` — the IP assigned to the client

### Alternative: Use an IP Pool for Multiple Users

\`\`\`
/ip pool add name=pptp-pool ranges=192.168.100.10-192.168.100.50

/ppp profile add name=pptp-profile   local-address=192.168.100.1   remote-address=pptp-pool   dns-server=8.8.8.8

/ppp secret add name=vpnuser1 password=Pass1 service=pptp profile=pptp-profile
/ppp secret add name=vpnuser2 password=Pass2 service=pptp profile=pptp-profile
\`\`\`

### Firewall Rule for PPTP

Allow incoming PPTP connections on the WAN:

\`\`\`
/ip firewall filter add chain=input protocol=tcp dst-port=1723 action=accept   comment="Allow PPTP"
/ip firewall filter add chain=input protocol=gre action=accept   comment="Allow GRE for PPTP"
\`\`\`

PPTP uses TCP port 1723 and GRE protocol (IP protocol 47).

### View Connected PPTP Clients

\`\`\`
/interface pptp-server print
\`\`\`

Or see active connections:

\`\`\`
/ppp active print
\`\`\`

## Part 2: Setting Up the L2TP/IPsec Server

L2TP combined with IPsec is more secure than PPTP. RouterOS handles the IPsec part automatically when you enable the \`ipsec-secret\`.

### Enable the L2TP Server

\`\`\`
/interface l2tp-server server set enabled=yes   authentication=mschap2   default-profile=default-encryption   ipsec-secret=IPsecSharedKey123   use-ipsec=required
\`\`\`

Parameters:
- \`ipsec-secret\` — the pre-shared key for IPsec. All clients use this same key (in addition to their username/password)
- \`use-ipsec=required\` — require IPsec encryption (reject plain L2TP without IPsec)

### Create User Accounts for L2TP

\`\`\`
/ip pool add name=l2tp-pool ranges=192.168.200.10-192.168.200.50

/ppp profile add name=l2tp-profile   local-address=192.168.200.1   remote-address=l2tp-pool   dns-server=8.8.8.8   use-compression=no

/ppp secret add name=vpnuser1 password=SecurePass123   service=l2tp   profile=l2tp-profile

/ppp secret add name=vpnuser2 password=AnotherPass456   service=l2tp   profile=l2tp-profile
\`\`\`

### Firewall Rules for L2TP/IPsec

\`\`\`
/ip firewall filter add chain=input protocol=udp dst-port=1701 action=accept   comment="L2TP"
/ip firewall filter add chain=input protocol=udp dst-port=500 action=accept   comment="IKE for IPsec"
/ip firewall filter add chain=input protocol=udp dst-port=4500 action=accept   comment="IPsec NAT-T"
/ip firewall filter add chain=input protocol=ipsec-esp action=accept   comment="IPsec ESP"
\`\`\`

### View Connected L2TP Clients

\`\`\`
/interface l2tp-server print
/ppp active print
\`\`\`

## Connecting from a Client

### Windows — L2TP/IPsec

1. Go to Settings → Network & Internet → VPN → Add a VPN connection
2. VPN provider: Windows (built-in)
3. VPN type: L2TP/IPsec with pre-shared key
4. Pre-shared key: \`IPsecSharedKey123\` (your ipsec-secret)
5. Username/password: the credentials from \`/ppp secret\`

### Windows — PPTP

1. Same path, VPN type: PPTP
2. Enter the router's WAN IP as the server address
3. Enter username and password

### macOS and iOS

Both support L2TP/IPsec natively in the VPN settings.

### Android

Android supports L2TP/IPsec in Settings → Network → VPN.

## Using the Same Account for Both Protocols

If you set \`service=any\`, the account works for both PPTP and L2TP:

\`\`\`
/ppp secret add name=vpnuser1 password=SecurePass123   service=any   profile=l2tp-profile
\`\`\`

## Monitoring VPN Usage

See all active VPN sessions:

\`\`\`
/ppp active print detail
\`\`\`

Output includes username, interface, uptime, and bytes transferred.

See VPN usage in the log:

\`\`\`
/log print where topics~"ppp"
\`\`\`

## Assigning a Specific IP to a User

If you always want the same IP for a user:

\`\`\`
/ppp secret set [find name=vpnuser1] remote-address=192.168.200.25
\`\`\`

This overrides the pool and always gives this user 192.168.200.25.

## Summary

- PPTP: easy to set up but **insecure** — use only for legacy compatibility
- L2TP/IPsec: more secure, recommended for remote access
- Users are managed under \`/ppp secret\`
- Enable PPTP with \`/interface pptp-server server set enabled=yes\`
- Enable L2TP with \`/interface l2tp-server server set enabled=yes ipsec-secret=...\`
- Always open required firewall ports on the WAN interface
- Monitor connections with \`/ppp active print\`
`,
    contentFa: `## راه‌اندازی سرور VPN با PPTP و L2TP در میکروتیک

RouterOS از چندین پروتکل VPN برای دسترسی از راه دور پشتیبانی می‌کند. این راهنما PPTP و L2TP را پوشش می‌دهد.

## نکته امنیتی مهم

**PPTP ناامن است** — رمزگذاری آن آسیب‌پذیری‌های شناخته‌شده دارد و نباید برای داده‌های حساس استفاده شود.

**L2TP/IPsec توصیه می‌شود** — L2TP به تنهایی رمزگذاری ندارد، اما RouterOS به‌صورت خودکار IPsec را با آن ترکیب می‌کند.

## بخش ۱: راه‌اندازی سرور PPTP

### فعال‌سازی سرور

\`\`\`
/interface pptp-server server set enabled=yes authentication=mschap2   default-profile=default-encryption
\`\`\`

### ایجاد کاربر

\`\`\`
/ppp secret add name=vpnuser1 password=SecurePass123   service=pptp   local-address=192.168.100.1   remote-address=192.168.100.10
\`\`\`

### استفاده از IP Pool

\`\`\`
/ip pool add name=pptp-pool ranges=192.168.100.10-192.168.100.50

/ppp profile add name=pptp-profile   local-address=192.168.100.1   remote-address=pptp-pool   dns-server=8.8.8.8

/ppp secret add name=vpnuser1 password=Pass1 service=pptp profile=pptp-profile
\`\`\`

### قوانین فایروال

\`\`\`
/ip firewall filter add chain=input protocol=tcp dst-port=1723 action=accept
/ip firewall filter add chain=input protocol=gre action=accept
\`\`\`

## بخش ۲: راه‌اندازی سرور L2TP/IPsec

### فعال‌سازی سرور

\`\`\`
/interface l2tp-server server set enabled=yes   authentication=mschap2   default-profile=default-encryption   ipsec-secret=IPsecSharedKey123   use-ipsec=required
\`\`\`

- \`ipsec-secret\` — کلید مشترک برای IPsec
- \`use-ipsec=required\` — L2TP بدون IPsec رد می‌شود

### ایجاد کاربران

\`\`\`
/ip pool add name=l2tp-pool ranges=192.168.200.10-192.168.200.50

/ppp profile add name=l2tp-profile   local-address=192.168.200.1   remote-address=l2tp-pool   dns-server=8.8.8.8

/ppp secret add name=vpnuser1 password=SecurePass123 service=l2tp profile=l2tp-profile
\`\`\`

### قوانین فایروال L2TP/IPsec

\`\`\`
/ip firewall filter add chain=input protocol=udp dst-port=1701 action=accept
/ip firewall filter add chain=input protocol=udp dst-port=500 action=accept
/ip firewall filter add chain=input protocol=udp dst-port=4500 action=accept
/ip firewall filter add chain=input protocol=ipsec-esp action=accept
\`\`\`

## اتصال از کلاینت

### ویندوز — L2TP/IPsec

1. Settings → Network → VPN → Add a VPN connection
2. نوع VPN: L2TP/IPsec with pre-shared key
3. کلید مشترک: \`IPsecSharedKey123\`
4. نام کاربری و رمز عبور از \`/ppp secret\`

### ویندوز — PPTP

1. همان مسیر، نوع VPN: PPTP
2. آدرس IP WAN روتر

## مشاهده کاربران متصل

\`\`\`
/ppp active print detail
\`\`\`

## خلاصه

- PPTP: راحت اما **ناامن** — فقط برای سازگاری با سیستم‌های قدیمی
- L2TP/IPsec: امن‌تر، توصیه‌شده برای دسترسی از راه دور
- کاربران زیر \`/ppp secret\` مدیریت می‌شوند
- پورت‌های لازم را در فایروال WAN باز کنید
- اتصالات را با \`/ppp active print\` مانیتور کنید
`,
  },
  'mikrotik-daily-maintenance-checklist': {
    contentEn: `## MikroTik Daily Maintenance Checklist

Preventive maintenance separates networks that run for years without issues from those that fail at the worst possible moment. This checklist covers the key things to verify regularly on every MikroTik router you manage.

### 1. Check System Resources

\`\`\`
/system resource print
\`\`\`

Look for:
- **CPU**: sustained load above 80% is a warning sign (firewall rules, logging, or traffic flooding the CPU)
- **Memory**: RouterOS needs free memory; if free RAM drops below ~20 MB, investigate
- **Uptime**: note when the device last rebooted — unexpected reboots indicate power issues or crashes

### 2. Review Active Logs

\`\`\`
/log print where severity=warning
/log print where severity=error
/log print where severity=critical
\`\`\`

Look for recurring error messages, authentication failures, or interface errors. One error occasionally is fine; the same error every few minutes needs investigation.

### 3. Check Interface Status

\`\`\`
/interface print
/interface ethernet print stats
\`\`\`

Look for unexpected \`R\` (running=no) interfaces, or high error/drop counters which indicate physical layer problems (bad cable, duplex mismatch, or SFP issues).

### 4. Verify All Tunnels and WAN Connections

\`\`\`
/interface pppoe-client print
/ip ipsec active-peers print
/interface wireguard peers print
\`\`\`

Check that all VPN tunnels and WAN connections are active. Automated monitoring (Netwatch) should alert you if they drop, but a visual check is good habit.

### 5. Check DHCP Leases and Pool Exhaustion

\`\`\`
/ip pool print
/ip dhcp-server lease print count-only
\`\`\`

If your DHCP pool only has a handful of addresses left, you may be approaching exhaustion. Investigate stale leases or expand the pool before clients start failing to get IPs.

### 6. Review Firewall Connection Table

\`\`\`
/ip firewall connection print count-only
\`\`\`

A dramatically higher connection count than usual may indicate a scanning attack, malware on a client, or a DoS event. Normal counts vary by network size.

### 7. Check Queue Drops

\`\`\`
/queue simple print stats
\`\`\`

High packet drop percentages mean your bandwidth limits are actively throttling traffic — either expected (your policy is working) or unexpected (a new bandwidth consumer appeared).

### 8. Verify DNS Resolution

\`\`\`
/resolve google.com
\`\`\`

If this fails, DNS is broken — clients will experience "no internet" symptoms even though routing may be fine.

### 9. Confirm NTP Sync

\`\`\`
/system ntp client print
\`\`\`

Confirm the time is accurate. Log timestamps from a clock-drifted router are useless for security forensics.

### 10. Check Available Disk Space (for devices with storage)

\`\`\`
/disk print
/file print
\`\`\`

Old backup and export files accumulate. Purge backups older than 30-90 days.

### Quick Health Summary Command

Combine multiple checks into one terminal session:

\`\`\`
/system resource print
/interface print
/ip route print where active=yes
/ip firewall connection print count-only
/log print where severity=warning count-only
\`\`\`

Running through this checklist takes under 5 minutes but catches 90% of problems before they become incidents. Build it into your weekly routine or, better yet, automate these checks with a monitoring system that alerts you proactively.`,
    contentFa: `## چک‌لیست نگهداری روزانه میکروتیک

نگهداری پیشگیرانه شبکه‌هایی را که سال‌ها بدون مشکل کار می‌کنند از آن‌هایی که در بدترین لحظه ممکن خراب می‌شوند جدا می‌کند. این چک‌لیست کارهای کلیدی است که باید به‌طور منظم روی هر روتر میکروتیک که مدیریت می‌کنید بررسی کنید.

### ۱. بررسی منابع سیستم

\`\`\`
/system resource print
\`\`\`

دنبال اینها بگردید:
- **CPU**: بار پایدار بالای ۸۰٪ یک هشدار است (قوانین فایروال، لاگ‌گیری یا سیل ترافیک روی CPU)
- **حافظه**: RouterOS به رم آزاد نیاز دارد؛ اگر رم آزاد زیر ~۲۰ مگابایت افتاد، بررسی کنید
- **Uptime**: توجه کنید دستگاه آخرین بار چه زمانی ریبوت کرد — ریبوت‌های غیرمنتظره نشان‌دهنده مشکلات برق یا کرش است

### ۲. بررسی لاگ‌های فعال

\`\`\`
/log print where severity=warning
/log print where severity=error
/log print where severity=critical
\`\`\`

دنبال پیام‌های خطای تکرارشونده، شکست‌های احراز هویت یا خطاهای اینترفیس بگردید.

### ۳. بررسی وضعیت اینترفیس

\`\`\`
/interface print
/interface ethernet print stats
\`\`\`

دنبال اینترفیس‌های غیرمنتظره با \`running=no\` یا شمارنده‌های خطا/drop بالا بگردید.

### ۴. بررسی همه تونل‌ها و اتصالات WAN

\`\`\`
/interface pppoe-client print
/ip ipsec active-peers print
/interface wireguard peers print
\`\`\`

بررسی کنید همه تونل‌های VPN و اتصالات WAN فعال هستند.

### ۵. بررسی Lease‌های DHCP و اتمام Pool

\`\`\`
/ip pool print
/ip dhcp-server lease print count-only
\`\`\`

اگر pool DHCP شما فقط چند آدرس خالی دارد، ممکن است به اتمام نزدیک باشید.

### ۶. بررسی تعداد اتصالات فایروال

\`\`\`
/ip firewall connection print count-only
\`\`\`

تعداد اتصال به‌طور چشمگیر بالاتر از معمول ممکن است نشان‌دهنده حمله اسکن، بدافزار روی کلاینت یا رویداد DoS باشد.

### ۷. بررسی Drop‌های Queue

\`\`\`
/queue simple print stats
\`\`\`

درصد drop بسته بالا یعنی محدودیت‌های پهنای‌باند شما فعالانه ترافیک را محدود می‌کنند.

### ۸. تأیید تفسیر DNS

\`\`\`
/resolve google.com
\`\`\`

اگر این شکست خورد، DNS خراب است — کلاینت‌ها علائم "اینترنت ندارم" خواهند داشت حتی اگر روتینگ درست باشد.

### ۹. تأیید همگام‌سازی NTP

\`\`\`
/system ntp client print
\`\`\`

### ۱۰. بررسی فضای دیسک موجود

\`\`\`
/disk print
/file print
\`\`\`

فایل‌های بکاپ و export قدیمی را پاک کنید.

گذراندن این چک‌لیست کمتر از ۵ دقیقه طول می‌کشد اما ۹۰٪ مشکلات را قبل از اینکه به حادثه تبدیل شوند تشخیص می‌دهد. آن را در برنامه هفتگی خود بگنجانید یا بهتر از آن، با یک سیستم مانیتورینگ که فعالانه به شما هشدار می‌دهد خودکار کنید.`,
  },
  'mikrotik-config-backup-automation-ftp': {
    contentEn: `## Automating Config Backup Upload to FTP in MikroTik

Manual backups only help if someone remembers to run them. Automating the backup process — and uploading it off-device — ensures you always have a recent config to recover from, even if the hardware fails completely.

### Step 1: Configure Email or FTP for Off-Device Storage

For FTP upload, RouterOS has a built-in FTP client. Set up a script that creates the backup then uploads it:

\`\`\`
/system script add name=backup-and-upload source={
  :local filename ("backup-" . [:tostr [/system clock get date]])
  /system backup save name=$filename
  /tool fetch upload=yes address=192.168.10.100 src-path=($filename . ".backup") dst-path=("/backups/" . $filename . ".backup") user=ftpuser password=ftppass mode=ftp
}
\`\`\`

### Step 2: Schedule the Script

\`\`\`
/system scheduler add name=weekly-backup interval=7d start-time=02:00:00 on-event=backup-and-upload
\`\`\`

### Step 3: Email Backup (Alternative)

If you have no FTP server, email the backup directly:

\`\`\`
/tool e-mail set address=smtp.gmail.com port=587 user=yourbot@gmail.com password=AppPassword from=yourbot@gmail.com

/system script add name=backup-email source={
  :local filename ("backup-" . [:tostr [/system clock get date]])
  /system backup save name=$filename
  /tool e-mail send to=admin@example.com subject=("RouterBackup " . $filename) file=($filename . ".backup")
}
\`\`\`

For Gmail, use an App Password (requires 2FA enabled on the account).

### Step 4: Export Script Config (Readable Text)

Include an export alongside the binary backup for human-readable recovery:

\`\`\`
/system script add name=backup-and-export source={
  :local date [:tostr [/system clock get date]]
  :local bname ("backup-" . $date)
  :local ename ("export-" . $date)
  /system backup save name=$bname
  /export file=$ename
  /tool fetch upload=yes address=192.168.10.100 src-path=($bname . ".backup") dst-path=("/backups/" . $bname . ".backup") user=ftpuser password=ftppass mode=ftp
  /tool fetch upload=yes address=192.168.10.100 src-path=($ename . ".rsc") dst-path=("/backups/" . $ename . ".rsc") user=ftpuser password=ftppass mode=ftp
}
\`\`\`

### Cleaning Up Old Local Files

Add cleanup to the script to prevent filling internal storage:

\`\`\`
  :foreach f in=[/file find where name~"backup-"] do={
    :if ([:totime [/file get $f creation-time]] < ([:totime [/system clock get time]] - 30d)) do={
      /file remove $f
    }
  }
\`\`\`

(RouterOS scripting date/time arithmetic can be complex — a simpler approach is to only keep the latest 3 backups by listing and removing old ones by index.)

### Testing the Backup Job

Run it manually first to confirm it works before relying on the scheduler:

\`\`\`
/system script run backup-and-upload
\`\`\`

Check the Files area and your FTP server to confirm both the backup file was created and uploaded.

### Verification Tip

Periodically restore a backup in a CHR test VM to verify the backup is actually restorable. A backup file that exists but can't be restored is worthless.

Automated off-device backups cost almost nothing in setup time and can save days of reconfiguration work after a hardware failure or accidental config change.`,
    contentFa: `## خودکارسازی آپلود بکاپ تنظیمات به FTP در میکروتیک

بکاپ‌های دستی فقط کمک می‌کنند اگر کسی به یادشان بیاید. خودکارسازی فرآیند بکاپ — و آپلود آن خارج از دستگاه — اطمینان می‌دهد که همیشه یک تنظیمات اخیر برای بازیابی دارید، حتی اگر سخت‌افزار کاملاً خراب شود.

### مرحله ۱: تنظیم FTP یا ایمیل برای ذخیره‌سازی خارج از دستگاه

برای آپلود FTP، RouterOS یک کلاینت FTP داخلی دارد:

\`\`\`
/system script add name=backup-and-upload source={
  :local filename ("backup-" . [:tostr [/system clock get date]])
  /system backup save name=$filename
  /tool fetch upload=yes address=192.168.10.100 src-path=($filename . ".backup") dst-path=("/backups/" . $filename . ".backup") user=ftpuser password=ftppass mode=ftp
}
\`\`\`

### مرحله ۲: زمان‌بندی اسکریپت

\`\`\`
/system scheduler add name=weekly-backup interval=7d start-time=02:00:00 on-event=backup-and-upload
\`\`\`

### مرحله ۳: بکاپ ایمیل (جایگزین)

اگر سرور FTP ندارید، مستقیماً بکاپ را ایمیل کنید:

\`\`\`
/tool e-mail set address=smtp.gmail.com port=587 user=yourbot@gmail.com password=AppPassword from=yourbot@gmail.com

/system script add name=backup-email source={
  :local filename ("backup-" . [:tostr [/system clock get date]])
  /system backup save name=$filename
  /tool e-mail send to=admin@example.com subject=("RouterBackup " . $filename) file=($filename . ".backup")
}
\`\`\`

برای Gmail از App Password استفاده کنید.

### مرحله ۴: Export اسکریپت تنظیمات

یک export کنار بکاپ باینری برای بازیابی خوانا اضافه کنید:

\`\`\`
/system script add name=backup-and-export source={
  :local date [:tostr [/system clock get date]]
  :local bname ("backup-" . $date)
  :local ename ("export-" . $date)
  /system backup save name=$bname
  /export file=$ename
  /tool fetch upload=yes address=192.168.10.100 src-path=($bname . ".backup") dst-path=("/backups/" . $bname . ".backup") user=ftpuser password=ftppass mode=ftp
}
\`\`\`

### آزمایش کار بکاپ

قبل از اتکا به scheduler، ابتدا دستی اجرا کنید:

\`\`\`
/system script run backup-and-upload
\`\`\`

بخش Files و سرور FTP خود را بررسی کنید تا تأیید کنید هم فایل بکاپ ایجاد شده و هم آپلود شده.

### نکته تأیید

به‌صورت دوره‌ای یک بکاپ را در یک VM آزمایشی CHR بازگردانید تا تأیید کنید بکاپ واقعاً قابل بازگردانی است. یک فایل بکاپ که وجود دارد اما قابل بازگردانی نیست بی‌ارزش است.

بکاپ‌های خودکار خارج از دستگاه تقریباً هیچ هزینه راه‌اندازی ندارند و می‌توانند روزها کار بازپیکربندی بعد از خرابی سخت‌افزار را نجات دهند.`,
  },
  'mikrotik-internet-troubleshooting': {
    contentEn: `## Troubleshooting Internet Connectivity on MikroTik

"The Internet is down" is the most common complaint in any network. Before calling your ISP, work through this structured diagnostic process to determine if the problem is in your router, your ISP connection, or further upstream.

### Step 1: Verify the WAN Interface Has an IP

\`\`\`
/ip address print
\`\`\`

If your WAN interface (ether1, pppoe-out1) has no IP address, the ISP link is down or misconfigured.

For DHCP WAN:
\`\`\`
/ip dhcp-client print
\`\`\`

For PPPoE:
\`\`\`
/interface pppoe-client print status
\`\`\`

### Step 2: Check the Default Route

\`\`\`
/ip route print where dst-address=0.0.0.0/0
\`\`\`

Without an active (\`A\`) default route, the router has no path to the Internet. Check if the WAN interface is up.

### Step 3: Ping the ISP Gateway

\`\`\`
/ip route print  # note the gateway IP
/ping 203.0.113.1  # ping the gateway
\`\`\`

If the gateway doesn't respond, the problem is on the ISP link — modem, fiber ONT, or the ISP's router. Try power-cycling the modem and waiting 2 minutes.

### Step 4: Ping a Public IP (Bypassing DNS)

\`\`\`
/ping 8.8.8.8
\`\`\`

If the ISP gateway responds but 8.8.8.8 doesn't, your ISP may be filtering or routing is broken upstream. Contact your ISP.

### Step 5: Test DNS Resolution

\`\`\`
/resolve google.com
\`\`\`

If step 4 (ping by IP) works but \`resolve\` fails, DNS is broken. Check:

\`\`\`
/ip dns print
\`\`\`

Ensure \`servers\` has valid IPs. Try manually resolving with a different server:

\`\`\`
/resolve google.com server=8.8.8.8
\`\`\`

### Step 6: Check Client Connectivity Separately

If the router itself has Internet, but clients don't:

\`\`\`
# From a client, can it reach the router?
/ping 192.168.10.1  # from client

# Can clients reach the router's LAN IP?
/ping 192.168.10.50  # from router to a client
\`\`\`

If clients can reach the router but not Internet: check NAT masquerade and the firewall forward chain.

\`\`\`
/ip firewall nat print
/ip firewall filter print
\`\`\`

### Step 7: Check for Firewall Blocking

The firewall might block traffic from clients going out:

\`\`\`
/ip firewall filter print where chain=forward
\`\`\`

Missing "established/related" accept rule is a common issue after firewall edits.

### Common Root Causes Summary

| Symptom | Likely Cause |
|---------|--------------|
| WAN has no IP | ISP link down, modem/ONT issue |
| No default route | WAN interface down |
| Gateway unreachable | Physical WAN issue |
| IP ping works, DNS fails | DNS server misconfigured |
| Router has internet, clients don't | NAT or forward chain firewall issue |
| Intermittent drops | MTU issue (PPPoE), ISP line quality |

Work top-down: WAN physical → WAN IP → routing → NAT → firewall → DNS. Most issues are found in the first three steps.`,
    contentFa: `## عیب‌یابی اتصال اینترنت در میکروتیک

"اینترنت قطع است" رایج‌ترین شکایت در هر شبکه‌ای است. قبل از تماس با ISP، این فرآیند تشخیصی ساختاریافته را طی کنید تا مشخص کنید مشکل در روتر، اتصال ISP یا بالادست‌تر است.

### مرحله ۱: بررسی داشتن آی‌پی اینترفیس WAN

\`\`\`
/ip address print
\`\`\`

اگر اینترفیس WAN (ether1، pppoe-out1) آی‌پی ندارد، لینک ISP قطع یا اشتباه تنظیم شده.

برای WAN DHCP:
\`\`\`
/ip dhcp-client print
\`\`\`

برای PPPoE:
\`\`\`
/interface pppoe-client print status
\`\`\`

### مرحله ۲: بررسی مسیر پیش‌فرض

\`\`\`
/ip route print where dst-address=0.0.0.0/0
\`\`\`

بدون یک مسیر پیش‌فرض فعال (\`A\`)، روتر هیچ مسیری به اینترنت ندارد.

### مرحله ۳: Ping گیت‌وی ISP

\`\`\`
/ping 203.0.113.1
\`\`\`

اگر گیت‌وی پاسخ نمی‌دهد، مشکل روی لینک ISP است. مودم را خاموش-روشن کرده و ۲ دقیقه صبر کنید.

### مرحله ۴: Ping یک آی‌پی عمومی (بدون DNS)

\`\`\`
/ping 8.8.8.8
\`\`\`

اگر گیت‌وی ISP پاسخ می‌دهد اما 8.8.8.8 نه، ISP ممکن است فیلتر کند یا روتینگ بالادست خراب باشد.

### مرحله ۵: آزمایش تفسیر DNS

\`\`\`
/resolve google.com
\`\`\`

اگر مرحله ۴ (ping با آی‌پی) کار می‌کند اما \`resolve\` شکست می‌خورد، DNS خراب است:

\`\`\`
/ip dns print
/resolve google.com server=8.8.8.8
\`\`\`

### مرحله ۶: بررسی اتصال کلاینت‌ها به‌طور جداگانه

اگر روتر اینترنت دارد اما کلاینت‌ها ندارند:

\`\`\`
/ip firewall nat print
/ip firewall filter print
\`\`\`

قانون missing "established/related" accept بعد از ویرایش‌های فایروال یک مشکل رایج است.

### خلاصه دلایل رایج

| علائم | دلیل احتمالی |
|---------|--------------|
| WAN آی‌پی ندارد | لینک ISP قطع، مشکل مودم/ONT |
| مسیر پیش‌فرض وجود ندارد | اینترفیس WAN قطع است |
| گیت‌وی غیرقابل دسترس | مشکل فیزیکی WAN |
| Ping IP کار می‌کند، DNS خراب | DNS اشتباه تنظیم |
| روتر اینترنت دارد، کلاینت‌ها ندارند | مشکل NAT یا فایروال forward chain |
| قطعی‌های متناوب | مشکل MTU (PPPoE)، کیفیت خط ISP |

از بالا به پایین کار کنید: WAN فیزیکی → آی‌پی WAN → روتینگ → NAT → فایروال → DNS. بیشتر مشکلات در سه مرحله اول پیدا می‌شوند.`,
  },
  'mikrotik-bandwidth-usage-monitor': {
    contentEn: `## Monitoring Bandwidth Usage on MikroTik

Knowing who is using your bandwidth and how much helps you plan capacity, spot anomalies, and enforce fair usage. MikroTik offers several built-in tools for bandwidth monitoring, from real-time sniffers to historical graphing.

### Real-Time: The Torch Tool

The Torch is RouterOS's packet sniffer and traffic monitor. In Winbox: Tools → Torch. On CLI:

\`\`\`
/tool torch interface=ether1 ip-protocol=any
\`\`\`

This shows live traffic per IP/protocol with source and destination, making it easy to see exactly what a specific IP is doing right now.

### Per-Interface Traffic with Graphing

Enable the built-in traffic graphs for any interface:

\`\`\`
/tool graphing interface add interface=ether1 store-on-disk=yes
\`\`\`

Then browse to \`http://routerip/graphs/\` (or use Winbox → Tools → Graphing) to see historical in/out traffic charts.

### Accounting: Track Per-IP Bandwidth Usage

RouterOS has a built-in IP accounting feature that tracks how much data each IP address sent and received:

\`\`\`
/ip accounting set enabled=yes account-local-traffic=no threshold=256
\`\`\`

View current stats:

\`\`\`
/ip accounting snapshot take
/ip accounting print
\`\`\`

This shows per-IP byte counts since the last reset. Reset with:

\`\`\`
/ip accounting clear
\`\`\`

### Queue Statistics for Per-User Tracking

If you have per-IP Simple Queues, each queue's stats give you per-user consumption:

\`\`\`
/queue simple print stats
\`\`\`

### SNMP + LibreNMS/Zabbix for Historical Trending

The most powerful approach for long-term capacity planning:

1. Enable SNMP as covered in the SNMP post
2. Add the router to LibreNMS or Zabbix
3. The platform polls interface counters every 5 minutes and stores them in a database
4. You get traffic graphs, 95th percentile calculations, and trend reports

### Bandwidth Usage by Protocol

Use Mangle to mark traffic by type, then see queue or accounting stats per mark:

\`\`\`
/ip firewall mangle add chain=forward protocol=tcp dst-port=80,443 action=mark-packet new-packet-mark=http-traffic passthrough=yes
/ip firewall mangle add chain=forward protocol=udp dst-port=53 action=mark-packet new-packet-mark=dns-traffic passthrough=yes
\`\`\`

Then in queue stats, you see separate counters for HTTP vs DNS vs everything else.

### Setting Up Usage Alerts

Use Netwatch or a Scheduler script to check a threshold and send an alert:

\`\`\`
/system script add name=check-bandwidth source={
  :local bps [/interface get ether1 rx-byte]
  :if ($bps > 900000000) do={
    /tool e-mail send to=admin@example.com subject="WAN Near Saturation" body="ether1 rx high"
  }
}
/system scheduler add name=bw-check interval=5m on-event=check-bandwidth
\`\`\`

Bandwidth visibility is the first step in capacity management. Without data, you're guessing — with data, you can make informed decisions about upgrading links, enforcing QoS, or investigating anomalies.`,
    contentFa: `## مانیتورینگ مصرف پهنای‌باند در میکروتیک

دانستن اینکه چه کسی پهنای‌باند شما را مصرف می‌کند و چقدر، به برنامه‌ریزی ظرفیت، تشخیص ناهنجاری‌ها و اعمال استفاده منصفانه کمک می‌کند. میکروتیک چندین ابزار داخلی برای مانیتورینگ پهنای‌باند ارائه می‌دهد.

### Real-Time: ابزار Torch

Torch ابزار packet sniffer و مانیتور ترافیک RouterOS است. در Winbox: Tools → Torch. در CLI:

\`\`\`
/tool torch interface=ether1 ip-protocol=any
\`\`\`

ترافیک زنده per-IP/protocol با مبدا و مقصد نشان می‌دهد.

### ترافیک Per-Interface با Graphing

\`\`\`
/tool graphing interface add interface=ether1 store-on-disk=yes
\`\`\`

سپس به \`http://routerip/graphs/\` بروید تا نمودارهای تاریخی ترافیک in/out را ببینید.

### Accounting: ردیابی مصرف پهنای‌باند Per-IP

\`\`\`
/ip accounting set enabled=yes account-local-traffic=no threshold=256
\`\`\`

مشاهده آمار فعلی:

\`\`\`
/ip accounting snapshot take
/ip accounting print
\`\`\`

این تعداد بایت per-IP از آخرین ریست نشان می‌دهد.

### آمار Queue برای ردیابی Per-User

\`\`\`
/queue simple print stats
\`\`\`

### SNMP + LibreNMS/Zabbix برای Trend تاریخی

قدرتمندترین رویکرد برای برنامه‌ریزی ظرفیت بلندمدت:

۱. SNMP را فعال کنید
۲. روتر را به LibreNMS یا Zabbix اضافه کنید
۳. پلتفرم هر ۵ دقیقه شمارنده‌های اینترفیس را poll می‌کند
۴. نمودارهای ترافیک، محاسبات صدک ۹۵ و گزارش‌های trend می‌گیرید

### تنظیم هشدارهای مصرف

\`\`\`
/system script add name=check-bandwidth source={
  :local bps [/interface get ether1 rx-byte]
  :if ($bps > 900000000) do={
    /tool e-mail send to=admin@example.com subject="WAN Near Saturation" body="ether1 rx high"
  }
}
/system scheduler add name=bw-check interval=5m on-event=check-bandwidth
\`\`\`

دیدگاه پهنای‌باند اولین قدم در مدیریت ظرفیت است. بدون داده، دارید حدس می‌زنید — با داده می‌توانید تصمیمات آگاهانه درباره ارتقاء لینک‌ها، اعمال QoS یا بررسی ناهنجاری‌ها بگیرید.`,
  },
  'mikrotik-ip-pool-dhcp-management': {
    contentEn: `## IP Pool and DHCP Management on MikroTik

Effective DHCP management keeps your network running smoothly. This post covers routine DHCP administration tasks: managing pools, cleaning stale leases, tracking clients, and handling IP conflicts.

### Reviewing Pool Utilization

\`\`\`
/ip pool used print
/ip pool print
\`\`\`

Compare \`used\` against the pool's range to gauge utilization. A pool nearing exhaustion means some clients will fail to get IPs.

### Listing All Active Leases

\`\`\`
/ip dhcp-server lease print
\`\`\`

Add status filters:

\`\`\`
/ip dhcp-server lease print where status=bound      # active leases
/ip dhcp-server lease print where status=waiting    # expiring/pending
\`\`\`

### Clearing Stale Leases

Old devices leave stale leases in your table. Manual cleanup:

\`\`\`
/ip dhcp-server lease remove [find status=waiting]
/ip dhcp-server lease remove [find last-seen>1d]
\`\`\`

Or adjust lease time so stale entries expire faster:

\`\`\`
/ip dhcp-server network set [find] lease-time=12h
\`\`\`

### Converting a Dynamic Lease to Static

When a device should always get the same IP:

\`\`\`
/ip dhcp-server lease make-static [find address=192.168.10.55]
\`\`\`

This locks that device's MAC to that IP. Alternatively, add manually:

\`\`\`
/ip dhcp-server lease add address=192.168.10.55 mac-address=AA:BB:CC:DD:EE:FF server=dhcp1
\`\`\`

### Searching for a Device by MAC

\`\`\`
/ip dhcp-server lease print where mac-address="AA:BB:CC:DD:EE:FF"
\`\`\`

Useful when a user reports connectivity problems — find their IP from MAC address.

### Finding Duplicate IPs

IP conflicts cause mysterious connectivity problems. Use ARP to find duplicates:

\`\`\`
/ip arp print
\`\`\`

If two MACs share the same IP, you have a conflict. Check for rogue DHCP servers or static IP assignments overlapping with the pool.

### Expanding the Pool When Running Low

\`\`\`
/ip pool set dhcp_pool ranges=192.168.10.10-192.168.10.250
\`\`\`

Or add a second pool range:

\`\`\`
/ip pool add name=dhcp_pool2 ranges=192.168.20.10-192.168.20.200
/ip dhcp-server set dhcp1 address-pool=dhcp_pool,dhcp_pool2
\`\`\`

### DHCP Lease Notification Script

Get notified when a new device joins:

\`\`\`
/system script add name=new-lease-alert source={
  :local mac [/ip dhcp-server lease get [find where dynamic=yes] mac-address]
  /tool e-mail send to=admin@example.com subject=("New device: " . $mac) body=($mac . " got IP")
}
/ip dhcp-server set dhcp1 lease-script=new-lease-alert
\`\`\`

### Blocking Specific Devices from DHCP

Add a static lease with an IP outside your pool to effectively block a MAC from getting an IP:

\`\`\`
/ip dhcp-server lease add mac-address=BA:D0:FF:EN:DE:D0 address=192.168.10.254 server=dhcp1 comment=blocked
\`\`\`

Or use the \`/ip dhcp-server lease make-permanent\` approach and then add a firewall rule blocking that IP.

Clean DHCP management prevents mysterious "no internet" calls and IP conflict incidents. Make lease table review part of your monthly maintenance routine.`,
    contentFa: `## مدیریت IP Pool و DHCP در میکروتیک

مدیریت مؤثر DHCP شبکه شما را روان نگه می‌دارد. این پست کارهای مدیریتی روتین DHCP را پوشش می‌دهد: مدیریت pool‌ها، پاک کردن lease‌های منسوخ، ردیابی کلاینت‌ها و مدیریت تعارض آی‌پی.

### بررسی استفاده از Pool

\`\`\`
/ip pool used print
/ip pool print
\`\`\`

\`used\` را با محدوده pool مقایسه کنید. Pool نزدیک به اتمام یعنی برخی کلاینت‌ها نمی‌توانند آی‌پی بگیرند.

### فهرست همه Lease‌های فعال

\`\`\`
/ip dhcp-server lease print where status=bound
\`\`\`

### پاک کردن Lease‌های منسوخ

\`\`\`
/ip dhcp-server lease remove [find status=waiting]
/ip dhcp-server lease remove [find last-seen>1d]
\`\`\`

### تبدیل Lease پویا به استاتیک

\`\`\`
/ip dhcp-server lease make-static [find address=192.168.10.55]
\`\`\`

### جست‌وجوی دستگاه با آدرس MAC

\`\`\`
/ip dhcp-server lease print where mac-address="AA:BB:CC:DD:EE:FF"
\`\`\`

مفید وقتی کاربری مشکل اتصال گزارش می‌دهد.

### یافتن آی‌پی‌های تکراری

\`\`\`
/ip arp print
\`\`\`

اگر دو MAC آی‌پی یکسان داشته باشند، تعارض دارید.

### گسترش Pool هنگام کمبود

\`\`\`
/ip pool set dhcp_pool ranges=192.168.10.10-192.168.10.250
\`\`\`

### اسکریپت اعلان Lease جدید

\`\`\`
/ip dhcp-server set dhcp1 lease-script=new-lease-alert
\`\`\`

### مسدود کردن دستگاه‌های خاص از DHCP

یک lease استاتیک با آی‌پی خارج از pool اضافه کنید تا یک MAC را از گرفتن آی‌پی مسدود کنید.

مدیریت تمیز DHCP از تماس‌های "اینترنت ندارم" و حوادث تعارض آی‌پی رازآلود جلوگیری می‌کند.`,
  },
  'mikrotik-interface-status-monitor': {
    contentEn: `## Monitoring Interface Status on MikroTik

Interface up/down events are often the first indicator of network problems. Monitoring interface status proactively — and getting alerted when something goes down — is a core network operations skill.

### Viewing Interface Status in Real Time

\`\`\`
/interface print
/interface ethernet print
\`\`\`

The \`R\` flag next to an interface means it is running (link is up). Absence of \`R\` means the link is down.

### Checking Interface Statistics

\`\`\`
/interface ethernet print stats
\`\`\`

Look for:
- \`rx-error\`, \`tx-error\`: hardware or duplex errors
- \`rx-drop\`, \`tx-drop\`: queue overflow (traffic shaping issue)
- \`tx-queue-drop\`: high output congestion

Steadily growing error counters indicate a physical problem.

### Monitoring a Specific Interface

\`\`\`
/interface ethernet monitor ether1
\`\`\`

This shows real-time link speed, duplex, and status — essential when troubleshooting physical connectivity.

### Using Netwatch to Alert on Interface Down

While Netwatch is primarily for ping-based monitoring, you can combine Scheduler with interface checks:

\`\`\`
/system script add name=check-interfaces source={
  :foreach i in=[/interface find where running=no type=ether] do={
    :local name [/interface get $i name]
    /tool e-mail send to=admin@example.com subject=("Interface DOWN: " . $name) body=$name
  }
}
/system scheduler add name=iface-monitor interval=5m on-event=check-interfaces
\`\`\`

This emails you if any Ethernet interface goes down.

### Automatic Interface Bounce on Error Threshold

If an interface accumulates errors beyond a threshold, reset it:

\`\`\`
/system script add name=check-errors source={
  :local errs [/interface ethernet get ether2 rx-error]
  :if ($errs > 10000) do={
    /interface disable ether2
    :delay 3s
    /interface enable ether2
    /tool e-mail send to=admin@example.com subject="ether2 error threshold - bounced" body=("errors: " . $errs)
  }
}
\`\`\`

### SNMP for Interface Monitoring

The most scalable approach is SNMP polling via LibreNMS or Zabbix. These platforms automatically alert you when any interface status changes, show historical uptime/downtime, and trend error counters.

Key SNMP OIDs for interfaces:
- \`IF-MIB::ifOperStatus.X\` — operational state (1=up, 2=down)
- \`IF-MIB::ifInErrors.X\` — incoming error counter
- \`IF-MIB::ifInOctets.X\` — incoming byte counter

### Graphing Interface Traffic

\`\`\`
/tool graphing interface add interface=ether1 store-on-disk=yes
\`\`\`

Browse \`http://routerip/graphs/iface/ether1/\` for hourly, daily, weekly, and monthly traffic graphs.

### Log-Based Interface Monitoring

RouterOS logs all interface up/down events by default:

\`\`\`
/log print where topics~"interface"
\`\`\`

Search for \`link up\` and \`link down\` messages to understand when an interface toggled.

Early detection of interface problems prevents outages from becoming major incidents. Set up at least basic alerting — even an email when an interface goes down — before you need it.`,
    contentFa: `## مانیتورینگ وضعیت اینترفیس در میکروتیک

رویدادهای up/down اینترفیس اغلب اولین نشانه مشکلات شبکه هستند. مانیتورینگ پیشگیرانه وضعیت اینترفیس و دریافت هشدار هنگام قطع آن یک مهارت اصلی عملیات شبکه است.

### مشاهده وضعیت اینترفیس در Real-Time

\`\`\`
/interface print
/interface ethernet print
\`\`\`

پرچم \`R\` کنار یک اینترفیس یعنی در حال اجرا (لینک بالا) است.

### بررسی آمار اینترفیس

\`\`\`
/interface ethernet print stats
\`\`\`

دنبال:
- \`rx-error\`، \`tx-error\`: خطاهای سخت‌افزاری یا duplex
- \`rx-drop\`، \`tx-drop\`: سرریز queue (مشکل traffic shaping)
- \`tx-queue-drop\`: ازدحام خروجی بالا

### مانیتورینگ یک اینترفیس خاص

\`\`\`
/interface ethernet monitor ether1
\`\`\`

سرعت لینک real-time، duplex و وضعیت — ضروری برای عیب‌یابی اتصال فیزیکی.

### استفاده از Scheduler برای هشدار قطع اینترفیس

\`\`\`
/system script add name=check-interfaces source={
  :foreach i in=[/interface find where running=no type=ether] do={
    :local name [/interface get $i name]
    /tool e-mail send to=admin@example.com subject=("Interface DOWN: " . $name) body=$name
  }
}
/system scheduler add name=iface-monitor interval=5m on-event=check-interfaces
\`\`\`

### SNMP برای مانیتورینگ اینترفیس

مقیاس‌پذیرترین رویکرد، SNMP polling از طریق LibreNMS یا Zabbix است. این پلتفرم‌ها به‌طور خودکار هنگام تغییر وضعیت هر اینترفیس هشدار می‌دهند.

### Graphing ترافیک اینترفیس

\`\`\`
/tool graphing interface add interface=ether1 store-on-disk=yes
\`\`\`

### مانیتورینگ مبتنی بر لاگ

\`\`\`
/log print where topics~"interface"
\`\`\`

تشخیص زودهنگام مشکلات اینترفیس از تبدیل قطعی‌ها به حوادث اصلی جلوگیری می‌کند.`,
  },
  'mikrotik-routeros-update-routine': {
    contentEn: `## RouterOS Update Routine: Keeping Firmware Current

Updating RouterOS regularly is not optional — it is part of responsible network management. This post covers how to build a repeatable, safe update process that fits into your operational workflow.

### Monthly Firmware Review Checklist

1. **Check current version**: \`/system resource print\`
2. **Check latest stable**: visit mikrotik.com/download and check your hardware's channel
3. **Read the changelog**: mikrotik.com/changelog — look for security fixes relevant to your setup
4. **Assess risk**: major version? patch? check community forums for reports of issues

### Update Channels

RouterOS has three release channels:

- **Stable**: thoroughly tested, recommended for production
- **Long-term (LTS)**: older version with extended support, maximum stability
- **Testing (Candidate)**: early access to new features — avoid in production

For most environments, stay on **Stable**.

### Pre-Update Steps

\`\`\`
# 1. Take a backup
/system backup save name=("pre-upgrade-" . [:tostr [/system clock get date]])

# 2. Note your current version
/system resource print

# 3. Check disk space for download
/disk print
/file print
\`\`\`

### Update via CLI

\`\`\`
/system package update check-for-updates channel=stable
/system package update download
\`\`\`

Wait for download to complete, then install (causes reboot):

\`\`\`
/system package update install
\`\`\`

### Update Multiple Routers Efficiently

For managing many devices, use The Dude (MikroTik's free network monitoring tool) or a simple bash loop with SSH:

\`\`\`bash
for ip in 192.168.1.1 192.168.2.1 192.168.3.1; do
  ssh admin@$ip "/system package update download; /system package update install"
done
\`\`\`

Or use Ansible with the community.routeros collection for proper change management.

### Post-Update Verification

After reboot:

\`\`\`
/system resource print  # confirm new version
/interface print         # all interfaces still up?
/ip route print         # routing table intact?
/ip firewall filter print count-only  # rule count matches?
\`\`\`

Compare with pre-upgrade \`/export\` if anything seems different.

### Handling Failed Updates

If the router doesn't come back after an update:

1. Console access (physical serial or Winbox over another path)
2. Check for package compatibility errors in the log
3. Use NetInstall as a last resort to reinstall clean RouterOS

### Scheduling Automatic Updates (Use With Caution)

RouterOS can check and download updates automatically, but don't enable automatic **install** without a maintenance window plan:

\`\`\`
/system package update set channel=stable
# Check-only automation (don't auto-install in production):
/system scheduler add name=check-updates interval=1w on-event="/system package update check-for-updates"
\`\`\`

Review and manually install during planned windows to avoid surprise reboots during business hours.

Keeping firmware current is boring until it isn't — a patched CVE prevented is far better than an emergency incident response after a compromise.`,
    contentFa: `## روتین آپدیت RouterOS: نگه‌داشتن فریمور به‌روز

به‌روزرسانی منظم RouterOS اختیاری نیست — بخشی از مدیریت مسئولانه شبکه است. این پست نحوه ساخت یک فرآیند آپدیت تکرارپذیر و ایمن را پوشش می‌دهد.

### چک‌لیست بررسی ماهانه فریمور

۱. **بررسی نسخه فعلی**: \`/system resource print\`
۲. **بررسی آخرین stable**: mikrotik.com/download
۳. **خواندن changelog**: mikrotik.com/changelog
۴. **ارزیابی ریسک**: نسخه اصلی؟ پچ؟

### کانال‌های آپدیت

RouterOS سه کانال انتشار دارد:
- **Stable**: کاملاً آزمایش‌شده، توصیه‌شده برای محیط تولید
- **Long-term (LTS)**: نسخه قدیمی‌تر با پشتیبانی گسترده
- **Testing**: دسترسی زودهنگام به قابلیت‌های جدید — در محیط تولید اجتناب کنید

### مراحل قبل از آپدیت

\`\`\`
/system backup save name=("pre-upgrade-" . [:tostr [/system clock get date]])
/system resource print
/disk print
\`\`\`

### آپدیت از طریق CLI

\`\`\`
/system package update check-for-updates channel=stable
/system package update download
/system package update install
\`\`\`

### تأیید بعد از آپدیت

\`\`\`
/system resource print
/interface print
/ip route print
/ip firewall filter print count-only
\`\`\`

با \`/export\` قبل از آپگرید مقایسه کنید اگر چیزی متفاوت به‌نظر می‌رسد.

### مدیریت آپدیت‌های شکست‌خورده

اگر روتر بعد از آپدیت برنگشت:
۱. دسترسی کنسول (سریال فیزیکی)
۲. بررسی خطاهای سازگاری پکیج در لاگ
۳. استفاده از NetInstall به‌عنوان آخرین راه‌چاره

به‌روز نگه‌داشتن فریمور کسل‌کننده است تا وقتی نباشد — یک CVE پچ‌شده جلوگیری‌شده بسیار بهتر از یک واکنش اضطراری به حادثه بعد از compromise است.`,
  },
  'mikrotik-firewall-rule-cleanup': {
    contentEn: `## Firewall Rule Cleanup and Maintenance on MikroTik

Firewall rule sets grow organically over time. Without periodic cleanup, you end up with hundreds of rules — many redundant, some conflicting, and a few that haven't matched a packet in years. A bloated firewall is harder to audit, slower to process, and full of hidden assumptions that may no longer be valid.

### Audit Step 1: Find Rules That Never Match

RouterOS tracks packet and byte counters per rule. A rule with 0 bytes and 0 packets since the last reboot likely either never applies or was made redundant by a rule above it:

\`\`\`
/ip firewall filter print stats where bytes=0
/ip firewall nat print stats where bytes=0
\`\`\`

Before deleting a zero-hit rule, understand **why** it never matched — it might be correct (a rule for a scenario that hasn't happened yet) or obsolete.

### Audit Step 2: Find Disabled Rules

\`\`\`
/ip firewall filter print where disabled=yes
\`\`\`

Disabled rules are noise. Either re-enable them (with documentation of why they exist) or delete them permanently.

### Audit Step 3: Identify Duplicates

Manually review the rule list for overlapping conditions:

\`\`\`
/ip firewall filter print
\`\`\`

Look for rules with identical matching criteria (same chain, same src/dst addresses, same ports) — one will always shadow the other.

### Audit Step 4: Review Rule Comments

Rules without comments are technical debt. Add comments to every non-obvious rule:

\`\`\`
/ip firewall filter set [find where comment=""] comment="review-me"
\`\`\`

Then investigate each "review-me" rule and document its purpose or delete it.

### Rebuilding a Clean Ruleset

For heavily cluttered rulesets, sometimes the cleanest approach is to export, edit the .rsc file in a text editor to produce a clean, ordered, commented set, test it in a CHR lab, then import cleanly:

\`\`\`
/export file=current-firewall
# edit current-firewall.rsc in external editor
/ip firewall filter remove [find]  # clear all (dangerous — have console access!)
/import file=clean-firewall.rsc
\`\`\`

### Ordering Rules for Performance

RouterOS evaluates rules in order. Place frequently-matching rules (established/related, the busiest subnet) near the top:

\`\`\`
/ip firewall filter move [find comment="established-related"] destination=0
\`\`\`

This reduces the average number of rules evaluated per packet.

### Using Connection State Efficiently

The most impactful optimization: one rule handles all established/related traffic at position 0:

\`\`\`
/ip firewall filter add chain=forward connection-state=established,related action=accept place-before=0
\`\`\`

This single rule eliminates the need to re-evaluate most traffic against the rest of the ruleset.

### Documenting Your Firewall Policy

Maintain a simple table outside RouterOS documenting what your firewall is supposed to do:

| Rule | Purpose | Direction | Action |
|------|---------|-----------|--------|
| Allow LAN to Internet | All clients can browse | forward in:ether2, out:ether1 | accept |
| Drop WAN to LAN unsolicited | No inbound from WAN | forward in:ether1 | drop |

This policy document helps you recognize when rules violate intent versus when intent itself needs updating.

Firewall maintenance is not glamorous, but a clean, documented, minimal ruleset is more secure and more maintainable than a tangled accumulation of historical changes.`,
    contentFa: `## پاکسازی و نگهداری قوانین فایروال در میکروتیک

مجموعه قوانین فایروال در طول زمان به‌طور ارگانیک رشد می‌کند. بدون پاکسازی دوره‌ای، با صدها قانون می‌مانید — بسیاری اضافی، برخی متعارض، و چند تا که سال‌هاست با هیچ بسته‌ای تطابق نداشته‌اند.

### مرحله ممیزی ۱: یافتن قوانینی که هرگز تطابق ندارند

\`\`\`
/ip firewall filter print stats where bytes=0
/ip firewall nat print stats where bytes=0
\`\`\`

قبل از حذف یک قانون با صفر ضربه، بفهمید **چرا** هرگز تطابق نداشته.

### مرحله ممیزی ۲: یافتن قوانین غیرفعال

\`\`\`
/ip firewall filter print where disabled=yes
\`\`\`

قوانین غیرفعال سروصدا هستند. آن‌ها را دوباره فعال کنید (با مستندات) یا به‌طور دائمی حذف کنید.

### مرحله ممیزی ۳: شناسایی موارد تکراری

\`\`\`
/ip firewall filter print
\`\`\`

دنبال قوانین با شرایط تطابق یکسان بگردید — یکی همیشه دیگری را سایه می‌اندازد.

### مرحله ممیزی ۴: بررسی کامنت‌های قوانین

قوانین بدون کامنت بدهی فنی هستند:

\`\`\`
/ip firewall filter set [find where comment=""] comment="review-me"
\`\`\`

### مرتب‌سازی قوانین برای کارایی

قوانین پرتطابق را در بالا قرار دهید (established/related، پرترافیک‌ترین ساب‌نت):

\`\`\`
/ip firewall filter move [find comment="established-related"] destination=0
\`\`\`

### استفاده کارآمد از Connection State

مهم‌ترین بهینه‌سازی:

\`\`\`
/ip firewall filter add chain=forward connection-state=established,related action=accept place-before=0
\`\`\`

این یک قانون نیاز به ارزیابی مجدد اکثر ترافیک در برابر بقیه مجموعه قوانین را حذف می‌کند.

یک مجموعه قوانین تمیز، مستندشده و حداقلی امن‌تر و قابل نگهداری‌تر از انباشت ترکیب‌شده تغییرات تاریخی است.`,
  },
  'mikrotik-torch-traffic-analysis': {
    contentEn: `## Using Torch for Real-Time Traffic Analysis on MikroTik

Torch is RouterOS's built-in packet analysis tool — think of it as a lightweight version of Wireshark focused on traffic summarization. It shows you what IP addresses and protocols are using your bandwidth **right now**, making it invaluable for troubleshooting, identifying bandwidth hogs, and spotting unusual traffic.

### Starting Torch on an Interface

In Winbox: Tools → Torch, select interface, click Start.

On CLI:

\`\`\`
/tool torch interface=ether1
\`\`\`

This shows all traffic on ether1 grouped by IP/protocol.

### Filtering Torch Output

\`\`\`
# By protocol
/tool torch interface=ether1 ip-protocol=tcp

# By port
/tool torch interface=ether1 port=80,443

# By specific IP
/tool torch interface=ether1 src-address=192.168.10.50

# By destination
/tool torch interface=ether1 dst-address=8.8.8.8
\`\`\`

### Understanding Torch Output Fields

- **Src. Address**: source IP
- **Dst. Address**: destination IP
- **Protocol**: TCP, UDP, ICMP, etc.
- **Src. Port / Dst. Port**: port numbers
- **Tx Rate / Rx Rate**: current bandwidth consumption
- **Tx / Rx Packets**: packet counts

### Common Torch Use Cases

**Case 1: Finding the bandwidth hog**

\`\`\`
/tool torch interface=ether1 ip-protocol=any
\`\`\`

Sort by Tx Rate. The top entries are your heaviest consumers right now.

**Case 2: Confirming a firewall rule works**

Apply a Torch filter for the traffic you just blocked. If it still shows traffic passing, your firewall rule isn't working as expected.

**Case 3: Identifying unusual protocols**

Filter for protocols you don't expect:

\`\`\`
/tool torch interface=ether1 ip-protocol=gre
\`\`\`

GRE, ESP, or unusual UDP traffic might indicate a VPN tunnel, or it could indicate unauthorized tunneling.

**Case 4: Troubleshooting a specific client**

\`\`\`
/tool torch interface=bridge1 src-address=192.168.10.25
\`\`\`

See everything that one client is sending and where it's going.

### Torch vs Other Tools

| Tool | Purpose |
|------|---------|
| Torch | Real-time traffic snapshot per flow |
| Graphing | Historical traffic rates per interface |
| Accounting | Total bytes per IP over time |
| Connection Print | Current connection state table |
| Sniffer | Full packet capture (like Wireshark) |

### Running Packet Capture (Advanced)

For detailed per-packet analysis beyond what Torch shows:

\`\`\`
/tool sniffer start interface=ether1 filter-ip-address=192.168.10.50
/tool sniffer stop
/tool sniffer save file=capture.pcap
\`\`\`

Download the .pcap file and open in Wireshark for deep analysis.

Torch takes 30 seconds to learn and instantly answers the question everyone asks during a network problem: "What traffic is actually flowing right now?" Make it your first diagnostic tool.`,
    contentFa: `## استفاده از Torch برای تحلیل ترافیک Real-Time در میکروتیک

Torch ابزار تحلیل بسته داخلی RouterOS است — مثل یک نسخه سبک‌تر از Wireshark با تمرکز بر خلاصه ترافیک. نشان می‌دهد **همین الان** کدام آدرس‌های آی‌پی و پروتکل‌ها پهنای‌باند شما را مصرف می‌کنند.

### شروع Torch روی یک اینترفیس

در Winbox: Tools → Torch، اینترفیس را انتخاب کنید، Start کنید.

در CLI:

\`\`\`
/tool torch interface=ether1
\`\`\`

### فیلترکردن خروجی Torch

\`\`\`
/tool torch interface=ether1 ip-protocol=tcp
/tool torch interface=ether1 port=80,443
/tool torch interface=ether1 src-address=192.168.10.50
\`\`\`

### فیلدهای خروجی Torch

- **Src./Dst. Address**: آی‌پی مبدا/مقصد
- **Protocol**: TCP، UDP، ICMP و غیره
- **Tx Rate / Rx Rate**: مصرف پهنای‌باند فعلی

### کاربردهای رایج Torch

**پیدا کردن کسی که پهنای‌باند را می‌خورد:**
\`\`\`
/tool torch interface=ether1 ip-protocol=any
\`\`\`
بر اساس Tx Rate مرتب کنید.

**تأیید کار کردن یک قانون فایروال:**
فیلتر Torch را برای ترافیکی که تازه بلاک کردید اعمال کنید.

**شناسایی پروتکل‌های غیرمعمول:**
\`\`\`
/tool torch interface=ether1 ip-protocol=gre
\`\`\`

**عیب‌یابی یک کلاینت خاص:**
\`\`\`
/tool torch interface=bridge1 src-address=192.168.10.25
\`\`\`

### Packet Capture (پیشرفته)

\`\`\`
/tool sniffer start interface=ether1 filter-ip-address=192.168.10.50
/tool sniffer stop
/tool sniffer save file=capture.pcap
\`\`\`

Torch 30 ثانیه طول می‌کشد یاد بگیرید و فوراً به سؤالی که همه هنگام مشکل شبکه می‌پرسند جواب می‌دهد: "همین الان چه ترافیکی واقعاً جاری است؟"`,
  },
  'mikrotik-certificate-management': {
    contentEn: `## Certificate Management on MikroTik RouterOS

Certificates in RouterOS are used for HTTPS (WebFig over SSL), IPsec/IKEv2 VPN authentication, SSTP VPN, and the API over TLS. Understanding how to create, import, and manage certificates prevents expired-certificate outages and enables secure encrypted management.

### Types of Certificates in RouterOS

1. **Self-signed**: created on the router, not trusted by browsers by default
2. **CA-signed**: signed by an internal CA or public CA (Let's Encrypt), trusted by clients
3. **Imported**: external certificates uploaded to the router

### Creating a Self-Signed CA and Certificate

\`\`\`
# Create the CA certificate
/certificate add name=my-ca common-name=MyCA key-size=4096 days-valid=3650 key-usage=crl-sign,key-cert-sign
/certificate sign my-ca

# Create a server certificate signed by the CA
/certificate add name=webfig-cert common-name=router.lab.local days-valid=365 key-size=2048 key-usage=digital-signature,key-encipherment,tls-server
/certificate sign webfig-cert ca=my-ca
\`\`\`

### Assigning Certificate to HTTPS (WebFig)

\`\`\`
/ip service set www-ssl certificate=webfig-cert disabled=no
/ip service disable www
\`\`\`

Now WebFig is available on HTTPS. Install the CA certificate on client browsers to make it trusted without a warning.

### Importing an External Certificate

Upload the certificate file via Winbox Files, then:

\`\`\`
/certificate import file-name=domain.crt passphrase=""
/certificate import file-name=domain.key passphrase=""
\`\`\`

After import, set the certificate's name:

\`\`\`
/certificate set [find where name~"domain"] name=my-imported-cert
\`\`\`

### Checking Certificate Status

\`\`\`
/certificate print detail
\`\`\`

Look at:
- \`invalid-before\` / \`invalid-after\`: validity window
- \`trusted\`: whether this cert is trusted
- \`fingerprint\`: use to verify against what your CA issued

### Renewing Expiring Certificates

RouterOS doesn't auto-renew certificates. Set a reminder (or a Scheduler script) to check 30 days before expiry:

\`\`\`
/system scheduler add name=cert-check interval=7d on-event={
  :foreach cert in=[/certificate find] do={
    :local expiry [/certificate get $cert invalid-after]
    :log info ("Certificate " . [/certificate get $cert name] . " expires " . $expiry)
  }
}
\`\`\`

### Let's Encrypt via ACME (RouterOS v7.x)

RouterOS v7 added support for ACME protocol for automatic Let's Encrypt certificate management:

\`\`\`
/certificate acme set account-key-size=2048
/certificate acme add domain=router.example.com
/certificate acme issue domain=router.example.com
\`\`\`

This requires the router to be publicly accessible on port 80 (HTTP-01 challenge) or DNS-01 challenge setup.

### Using Certificates for VPN (IKEv2)

When configuring IKEv2 IPsec with certificate authentication instead of pre-shared keys:

\`\`\`
/ip ipsec identity add auth-method=digital-signature certificate=webfig-cert remote-certificate=client-cert
\`\`\`

Certificate-based VPN authentication is more secure than PSK (no shared secrets to leak) and scales better for large deployments.

Managing certificates proactively prevents the scenario where your management interface becomes unavailable because a certificate expired at midnight on a Friday.`,
    contentFa: `## مدیریت گواهی‌نامه در MikroTik RouterOS

گواهی‌نامه‌ها در RouterOS برای HTTPS (WebFig روی SSL)، احراز هویت IPsec/IKEv2 VPN، SSTP VPN و API روی TLS استفاده می‌شوند.

### انواع گواهی‌نامه در RouterOS

۱. **Self-signed**: روی روتر ایجاد می‌شود، به‌طور پیش‌فرض توسط مرورگرها مورد اعتماد نیست
۲. **CA-signed**: توسط CA داخلی یا عمومی (Let's Encrypt) امضا شده
۳. **Imported**: گواهی‌نامه‌های خارجی آپلودشده به روتر

### ساخت CA Self-Signed و گواهی‌نامه

\`\`\`
/certificate add name=my-ca common-name=MyCA key-size=4096 days-valid=3650 key-usage=crl-sign,key-cert-sign
/certificate sign my-ca

/certificate add name=webfig-cert common-name=router.lab.local days-valid=365 key-size=2048 key-usage=digital-signature,key-encipherment,tls-server
/certificate sign webfig-cert ca=my-ca
\`\`\`

### اختصاص گواهی‌نامه به HTTPS (WebFig)

\`\`\`
/ip service set www-ssl certificate=webfig-cert disabled=no
/ip service disable www
\`\`\`

### وارد کردن یک گواهی‌نامه خارجی

\`\`\`
/certificate import file-name=domain.crt passphrase=""
/certificate import file-name=domain.key passphrase=""
/certificate set [find where name~"domain"] name=my-imported-cert
\`\`\`

### بررسی وضعیت گواهی‌نامه

\`\`\`
/certificate print detail
\`\`\`

دنبال \`invalid-before\`/\`invalid-after\` و \`trusted\` بگردید.

### تجدید گواهی‌نامه‌های در حال انقضا

RouterOS گواهی‌نامه‌ها را به‌طور خودکار تجدید نمی‌کند. یک یادآوری یا اسکریپت Scheduler برای ۳۰ روز قبل از انقضا تنظیم کنید.

### Let's Encrypt از طریق ACME (RouterOS v7.x)

\`\`\`
/certificate acme add domain=router.example.com
/certificate acme issue domain=router.example.com
\`\`\`

### استفاده از گواهی‌نامه برای VPN (IKEv2)

احراز هویت VPN مبتنی بر گواهی‌نامه امن‌تر از PSK است و برای استقرارهای بزرگ بهتر مقیاس‌پذیر است.

مدیریت پیشگیرانه گواهی‌نامه از سناریویی که رابط مدیریتی شما به‌خاطر انقضای گواهی‌نامه در نیمه‌شب جمعه غیردسترسی می‌شود جلوگیری می‌کند.`,
  },
  'mikrotik-attack-types-overview': {
    contentEn: `## Types of Attacks Against MikroTik Devices

MikroTik routers are powerful and widely deployed, which also makes them attractive targets for attackers. Understanding what attacks are used against MikroTik devices is the first step toward defending them.

### 1. Brute Force Attacks

Attackers use automated tools to try thousands of username/password combinations against:
- **Winbox** (port 8291)
- **SSH** (port 22)
- **Telnet** (port 23)
- **HTTP/HTTPS WebFig** (ports 80/443)

If the default admin account has no password (factory default), the device is compromised instantly.

### 2. Exploitation of Known Vulnerabilities

Several critical CVEs have been discovered in RouterOS:

| CVE | Year | Type | Impact |
|-----|------|------|--------|
| CVE-2018-14847 | 2018 | Winbox auth bypass | Read credentials from memory |
| CVE-2019-3977 | 2019 | Downgrade attack | Force old vulnerable RouterOS |
| CVE-2019-3978 | 2019 | DNS cache poisoning | Man-in-the-middle |
| CVE-2023-30799 | 2023 | Privilege escalation | Root on RouterOS |

### 3. Credential Theft via Winbox Exploit

The **Chimay Blue** exploit (CVE-2018-14847) allowed unauthenticated attackers to read the user database file from RouterOS, exposing all usernames and passwords in plaintext. Devices running RouterOS < 6.42.1 are vulnerable.

### 4. Man-in-the-Middle (MITM) Attacks

Attackers on the same network segment can:
- ARP-spoof to intercept traffic
- Capture Winbox sessions (older Winbox used no encryption)
- Inject routes via BGP if the router peers with untrusted neighbors

### 5. Botnet Recruitment (Mēris Botnet)

In 2021 MikroTik routers were weaponized into the **Mēris botnet**, which conducted record-breaking DDoS attacks. Attackers exploited unpatched routers (CVE-2018-14847) and installed SOCKS proxies to route attack traffic.

### 6. Port Scanning and Service Fingerprinting

Attackers use tools like Shodan, nmap, and masscan to find MikroTik devices exposed on the internet. Once identified, they probe for:
- Open Winbox port
- Default credentials
- Outdated RouterOS banners

\`\`\`bash
# What attackers run against your router (for awareness):
nmap -sV -p 22,23,80,443,8291 <target-ip>
\`\`\`

### 7. DNS Hijacking

Compromised MikroTik routers have been used to change DNS settings, redirecting users to malicious sites. This was observed in the **VPNFilter** malware campaign.

### 8. DDoS Amplification

MikroTik devices with open DNS resolvers or NTP services can be abused for amplification attacks — the attacker sends small spoofed packets and the router sends large replies to the victim.

### Mitigation Summary

- **Patch RouterOS** to the latest stable version.
- **Change default credentials** immediately.
- **Disable unused services** (Telnet, FTP, API if not needed).
- **Restrict management access** to trusted IPs only.
- **Use strong firewall rules** to block management ports from WAN.

The following posts in this series go deep on each mitigation technique.`,
    contentFa: `## انواع حملات علیه دستگاه‌های میکروتیک

روترهای میکروتیک قدرتمند و پرکاربرد هستند، که همین موضوع آن‌ها را به هدف جذابی برای مهاجمان تبدیل می‌کند. درک اینکه چه حملاتی علیه دستگاه‌های میکروتیک استفاده می‌شود، اولین قدم برای دفاع از آن‌هاست.

### ۱. حملات Brute Force

مهاجمان از ابزارهای خودکار استفاده می‌کنند تا هزاران ترکیب نام‌کاربری/رمزعبور را در برابر این سرویس‌ها امتحان کنند:
- **Winbox** (پورت ۸۲۹۱)
- **SSH** (پورت ۲۲)
- **Telnet** (پورت ۲۳)
- **HTTP/HTTPS WebFig** (پورت‌های ۸۰/۴۴۳)

اگر حساب admin پیش‌فرض رمزعبور نداشته باشد (تنظیمات کارخانه)، دستگاه فوراً در اختیار مهاجم قرار می‌گیرد.

### ۲. بهره‌برداری از آسیب‌پذیری‌های شناخته‌شده

چندین CVE بحرانی در RouterOS کشف شده:

| CVE | سال | نوع | تأثیر |
|-----|------|------|--------|
| CVE-2018-14847 | ۲۰۱۸ | دور زدن احراز هویت Winbox | خواندن اعتبارنامه از حافظه |
| CVE-2019-3977 | ۲۰۱۹ | حمله Downgrade | اجبار به نسخه قدیمی آسیب‌پذیر |
| CVE-2019-3978 | ۲۰۱۹ | مسموم‌سازی کش DNS | مرد میانی |
| CVE-2023-30799 | ۲۰۲۳ | افزایش امتیاز | دسترسی root به RouterOS |

### ۳. سرقت اعتبارنامه از طریق اکسپلویت Winbox

اکسپلویت **Chimay Blue** (CVE-2018-14847) به مهاجمان بدون احراز هویت اجازه می‌داد فایل پایگاه داده کاربران RouterOS را بخوانند و همه نام‌های کاربری و رمزهای عبور به‌صورت متن ساده افشا می‌شدند. دستگاه‌هایی که RouterOS < 6.42.1 دارند آسیب‌پذیرند.

### ۴. حملات مرد میانی (MITM)

مهاجمانی که در یک شبکه هستند می‌توانند:
- ARP spoofing انجام دهند تا ترافیک را رهگیری کنند
- جلسات Winbox را ضبط کنند (نسخه‌های قدیمی Winbox رمزنگاری نداشتند)
- از طریق BGP مسیرهای جعلی تزریق کنند

### ۵. جذب در بات‌نت (بات‌نت Mēris)

در سال ۲۰۲۱ روترهای میکروتیک به بات‌نت **Mēris** تبدیل شدند که حملات DDoS رکوردشکن انجام داد. مهاجمان روترهای بدون وصله (CVE-2018-14847) را اکسپلویت کردند و پروکسی SOCKS نصب کردند.

### ۶. اسکن پورت و شناسایی سرویس

مهاجمان از ابزارهایی مثل Shodan، nmap و masscan استفاده می‌کنند تا دستگاه‌های میکروتیک در اینترنت را پیدا کنند:

\`\`\`bash
# چیزی که مهاجمان علیه روتر شما اجرا می‌کنند (برای آگاهی):
nmap -sV -p 22,23,80,443,8291 <target-ip>
\`\`\`

### ۷. هایجک DNS

روترهای میکروتیک هک‌شده برای تغییر تنظیمات DNS استفاده شده‌اند که کاربران را به سایت‌های مخرب هدایت می‌کند. این در کمپین بدافزار **VPNFilter** مشاهده شد.

### ۸. تقویت DDoS

دستگاه‌های میکروتیک با DNS resolver باز یا سرویس‌های NTP می‌توانند برای حملات تقویت سوءاستفاده شوند.

### خلاصه اقدامات پیشگیرانه

- **RouterOS را به آخرین نسخه پایدار به‌روز کنید.**
- **اعتبارنامه‌های پیش‌فرض را فوراً تغییر دهید.**
- **سرویس‌های استفاده‌نشده را غیرفعال کنید** (Telnet، FTP، API).
- **دسترسی مدیریتی را محدود کنید** فقط به IPهای مورد اعتماد.
- **از قوانین فایروال قوی استفاده کنید** تا پورت‌های مدیریتی از WAN مسدود شوند.

پست‌های بعدی این سری به‌صورت عمیق هر تکنیک محافظتی را بررسی می‌کنند.`,
  },
  'mikrotik-brute-force-protection': {
    contentEn: `## Protecting MikroTik Against Brute Force Attacks

Brute force attacks try thousands of login combinations against your management interfaces. This post shows you how to detect and block them automatically using RouterOS firewall rules.

### How Brute Force Works

An attacker runs a tool like Hydra or Medusa:

\`\`\`bash
hydra -l admin -P /usr/share/wordlists/rockyou.txt 192.168.1.1 ssh
\`\`\`

Within minutes they can attempt tens of thousands of passwords. Without protection, RouterOS will try each one.

### Step 1 — Rename or Disable the Default Admin

\`\`\`
/user set [find name=admin] name=netadmin
\`\`\`

Or create a new admin and disable the default:

\`\`\`
/user add name=netadmin password=Str0ng!Pass group=full
/user disable admin
\`\`\`

### Step 2 — SSH Brute Force Protection with Address Lists

This technique uses address lists to temporarily ban IPs that fail SSH login too many times:

\`\`\`
/ip firewall filter

# Stage 1: If IP is already in the blocklist, drop immediately
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_blacklist action=drop comment="Drop SSH blacklist"

# Stage 2: Third failure within 1 minute → blacklist for 10 days
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_stage3 action=add-src-to-address-list address-list=ssh_blacklist address-list-timeout=10d comment="SSH stage3 → blacklist"

# Stage 3: Second failure → move to stage 3
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_stage2 action=add-src-to-address-list address-list=ssh_stage3 address-list-timeout=1m

# Stage 4: First failure → move to stage 2
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_stage1 action=add-src-to-address-list address-list=ssh_stage2 address-list-timeout=1m

# Stage 5: New connection attempt → add to stage 1
add chain=input protocol=tcp dst-port=22 connection-state=new action=add-src-to-address-list address-list=ssh_stage1 address-list-timeout=1m
\`\`\`

### Step 3 — Winbox Brute Force Protection

Apply the same logic to Winbox port 8291:

\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 src-address-list=winbox_blacklist action=drop comment="Drop Winbox blacklist"
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage3 action=add-src-to-address-list address-list=winbox_blacklist address-list-timeout=10d
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage2 action=add-src-to-address-list address-list=wb_stage3 address-list-timeout=1m
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage1 action=add-src-to-address-list address-list=wb_stage2 address-list-timeout=1m
add chain=input protocol=tcp dst-port=8291 connection-state=new action=add-src-to-address-list address-list=wb_stage1 address-list-timeout=1m
\`\`\`

### Step 4 — Rate Limit New Connections

An alternative (or complement) is to rate-limit new connections per source IP:

\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=22 connection-state=new action=jump jump-target=ssh-rate
/ip firewall filter
add chain=ssh-rate src-address-list=ssh-rl action=drop
add chain=ssh-rate action=add-src-to-address-list address-list=ssh-rl address-list-timeout=60s limit=3,5:packet
add chain=ssh-rate action=accept
\`\`\`

### Step 5 — Change Default Ports

Move SSH from 22 to a non-standard port:

\`\`\`
/ip service set ssh port=22222
\`\`\`

This won't stop a determined attacker but eliminates most automated scanners.

### Step 6 — Whitelist Your Management IP

The most effective protection: only allow your own IP to reach management services:

\`\`\`
/ip firewall filter
add chain=input src-address=203.0.113.10 action=accept comment="My management IP"
add chain=input protocol=tcp dst-port=22,8291,80,443 action=drop comment="Block all management from WAN"
\`\`\`

### Verify the Blacklist is Working

\`\`\`
/ip firewall address-list print where list=ssh_blacklist
\`\`\`

You should see IPs accumulating if any brute force is hitting the router.

### Summary Checklist

- [ ] Renamed/disabled default admin
- [ ] SSH brute force stages configured
- [ ] Winbox brute force stages configured
- [ ] Management restricted to whitelist IPs
- [ ] Default service ports changed`,
    contentFa: `## محافظت از میکروتیک در برابر حملات Brute Force

حملات brute force هزاران ترکیب ورود به سیستم را روی رابط‌های مدیریتی شما امتحان می‌کنند. این پست نشان می‌دهد چطور با استفاده از قوانین فایروال RouterOS، آن‌ها را به‌صورت خودکار شناسایی و مسدود کنید.

### چطور Brute Force کار می‌کند

مهاجم ابزاری مثل Hydra یا Medusa اجرا می‌کند:

\`\`\`bash
hydra -l admin -P /usr/share/wordlists/rockyou.txt 192.168.1.1 ssh
\`\`\`

در عرض چند دقیقه می‌تواند ده‌ها هزار رمز عبور را امتحان کند. بدون محافظت، RouterOS هر کدام را امتحان می‌کند.

### مرحله ۱ — تغییر نام یا غیرفعال کردن admin پیش‌فرض

\`\`\`
/user set [find name=admin] name=netadmin
\`\`\`

یا یک admin جدید بسازید و admin پیش‌فرض را غیرفعال کنید:

\`\`\`
/user add name=netadmin password=Str0ng!Pass group=full
/user disable admin
\`\`\`

### مرحله ۲ — محافظت SSH با Address Lists

این تکنیک از address list ها برای قرنطینه موقت IPهایی که چند بار در SSH شکست خورده‌اند استفاده می‌کند:

\`\`\`
/ip firewall filter

# مرحله ۱: اگر IP در لیست سیاه است، فوراً drop کن
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_blacklist action=drop comment="Drop SSH blacklist"

# مرحله ۲: سومین شکست در ۱ دقیقه → blacklist برای ۱۰ روز
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_stage3 action=add-src-to-address-list address-list=ssh_blacklist address-list-timeout=10d

# مرحله ۳: دومین شکست → انتقال به stage 3
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_stage2 action=add-src-to-address-list address-list=ssh_stage3 address-list-timeout=1m

# مرحله ۴: اولین شکست → انتقال به stage 2
add chain=input protocol=tcp dst-port=22 src-address-list=ssh_stage1 action=add-src-to-address-list address-list=ssh_stage2 address-list-timeout=1m

# مرحله ۵: اتصال جدید → اضافه به stage 1
add chain=input protocol=tcp dst-port=22 connection-state=new action=add-src-to-address-list address-list=ssh_stage1 address-list-timeout=1m
\`\`\`

### مرحله ۳ — محافظت Winbox

همان منطق را برای پورت Winbox 8291 اعمال کنید:

\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 src-address-list=winbox_blacklist action=drop
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage3 action=add-src-to-address-list address-list=winbox_blacklist address-list-timeout=10d
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage2 action=add-src-to-address-list address-list=wb_stage3 address-list-timeout=1m
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage1 action=add-src-to-address-list address-list=wb_stage2 address-list-timeout=1m
add chain=input protocol=tcp dst-port=8291 connection-state=new action=add-src-to-address-list address-list=wb_stage1 address-list-timeout=1m
\`\`\`

### مرحله ۴ — تغییر پورت‌های پیش‌فرض

SSH را از ۲۲ به یک پورت غیر استاندارد منتقل کنید:

\`\`\`
/ip service set ssh port=22222
\`\`\`

### مرحله ۵ — Whitelist IP مدیریتی

مؤثرترین راه: فقط به IP خودتان اجازه دهید به سرویس‌های مدیریتی دسترسی داشته باشد:

\`\`\`
/ip firewall filter
add chain=input src-address=203.0.113.10 action=accept comment="IP مدیریتی من"
add chain=input protocol=tcp dst-port=22,8291,80,443 action=drop comment="مسدود کردن مدیریت از WAN"
\`\`\`

### تأیید عملکرد Blacklist

\`\`\`
/ip firewall address-list print where list=ssh_blacklist
\`\`\`

باید IPهایی را ببینید که در حال تجمع هستند اگر brute force روی روتر در حال اتفاق باشد.`,
  },
  'mikrotik-port-knocking-setup': {
    contentEn: `## Port Knocking on MikroTik

Port knocking is a method of opening ports on a firewall by sending a sequence of connection attempts to pre-defined closed ports. Until the correct knock sequence is sent, management ports appear completely closed — even to scanners.

### How Port Knocking Works

1. Your management port (e.g., SSH on 22) is blocked by default.
2. You "knock" on a sequence of ports — e.g., 1111, 2222, 3333.
3. The firewall tracks the sequence. If all three are knocked in order within a time window, your IP is added to an "allowed" list.
4. SSH is then open to your IP for a limited time.

### Implementing Port Knocking in RouterOS

We use address lists and firewall rules to track the knock sequence:

\`\`\`
/ip firewall filter

# Rule 1: Accept SSH for IPs that completed the sequence
add chain=input protocol=tcp dst-port=22 src-address-list=knock_allowed action=accept comment="SSH open for knockers"

# Rule 2: Stage 3 knock — final knock adds to allowed list
add chain=input protocol=tcp dst-port=3333 src-address-list=knock_stage2 action=add-src-to-address-list address-list=knock_allowed address-list-timeout=30m comment="Knock stage 3 → allowed"

# Rule 3: Stage 2 knock
add chain=input protocol=tcp dst-port=2222 src-address-list=knock_stage1 action=add-src-to-address-list address-list=knock_stage2 address-list-timeout=15s comment="Knock stage 2"

# Rule 4: Stage 1 knock — first knock
add chain=input protocol=tcp dst-port=1111 connection-state=new action=add-src-to-address-list address-list=knock_stage1 address-list-timeout=15s comment="Knock stage 1"

# Rule 5: Drop SSH from everyone else
add chain=input protocol=tcp dst-port=22 action=drop comment="Default drop SSH"
\`\`\`

**Key parameters:**
- \`address-list-timeout=15s\` — the user must complete the sequence within 15 seconds
- \`address-list-timeout=30m\` — SSH access is granted for 30 minutes

### Sending the Knock Sequence

**From Linux:**
\`\`\`bash
knock 203.0.113.1 1111 2222 3333
\`\`\`
(requires \`knockd\` client: \`apt install knockd\`)

Or using nmap:
\`\`\`bash
nmap -Pn --host-timeout 100 --max-retries 0 -p 1111 203.0.113.1
nmap -Pn --host-timeout 100 --max-retries 0 -p 2222 203.0.113.1
nmap -Pn --host-timeout 100 --max-retries 0 -p 3333 203.0.113.1
\`\`\`

**From Windows (PowerShell):**
\`\`\`powershell
$ip = "203.0.113.1"
foreach ($port in 1111,2222,3333) {
    try { [System.Net.Sockets.TcpClient]::new($ip, $port) } catch {}
    Start-Sleep -Milliseconds 200
}
\`\`\`

### Verify It Works

After knocking, check if your IP is in the allowed list:
\`\`\`
/ip firewall address-list print where list=knock_allowed
\`\`\`

Then try SSHing in — it should work. After the 30-minute timeout, the entry disappears and SSH closes again.

### Important Notes

- Port knocking is **security through obscurity** — it delays attackers but does not replace strong passwords or key-based SSH auth.
- Combine it with SSH key authentication for maximum security.
- Choose non-obvious port numbers (not 1111, 2222 — use random high ports in production).

### Combining with SSH Key Auth

\`\`\`
/ip ssh set strong-crypto=yes
\`\`\`

Upload your public key to the router:
\`\`\`
/user ssh-keys import public-key-file=id_rsa.pub user=netadmin
\`\`\`

Now even if someone discovers the knock sequence, they still need the private key.`,
    contentFa: `## Port Knocking در میکروتیک

Port Knocking روشی است برای باز کردن پورت‌ها روی فایروال با ارسال یک دنباله از تلاش‌های اتصال به پورت‌های بسته از پیش تعریف‌شده. تا زمانی که دنباله صحیح knock ارسال نشود، پورت‌های مدیریتی کاملاً بسته به نظر می‌رسند.

### چطور Port Knocking کار می‌کند

۱. پورت مدیریتی شما (مثلاً SSH روی ۲۲) به‌طور پیش‌فرض مسدود است.
۲. یک دنباله از پورت‌ها را knock می‌کنید — مثلاً ۱۱۱۱، ۲۲۲۲، ۳۳۳۳.
۳. فایروال دنباله را دنبال می‌کند. اگر هر سه به ترتیب در یک پنجره زمانی زده شوند، IP شما به لیست "مجاز" اضافه می‌شود.
۴. سپس SSH برای IP شما برای مدت محدود باز می‌شود.

### پیاده‌سازی Port Knocking در RouterOS

\`\`\`
/ip firewall filter

# قانون ۱: قبول SSH برای IPهایی که دنباله را کامل کرده‌اند
add chain=input protocol=tcp dst-port=22 src-address-list=knock_allowed action=accept comment="SSH open for knockers"

# قانون ۲: knock مرحله ۳ — knock نهایی به لیست مجاز اضافه می‌کند
add chain=input protocol=tcp dst-port=3333 src-address-list=knock_stage2 action=add-src-to-address-list address-list=knock_allowed address-list-timeout=30m

# قانون ۳: knock مرحله ۲
add chain=input protocol=tcp dst-port=2222 src-address-list=knock_stage1 action=add-src-to-address-list address-list=knock_stage2 address-list-timeout=15s

# قانون ۴: knock مرحله ۱ — اولین knock
add chain=input protocol=tcp dst-port=1111 connection-state=new action=add-src-to-address-list address-list=knock_stage1 address-list-timeout=15s

# قانون ۵: Drop SSH برای بقیه
add chain=input protocol=tcp dst-port=22 action=drop comment="Default drop SSH"
\`\`\`

### ارسال دنباله knock

**از لینوکس:**
\`\`\`bash
knock 203.0.113.1 1111 2222 3333
\`\`\`

یا با استفاده از nmap:
\`\`\`bash
nmap -Pn --host-timeout 100 --max-retries 0 -p 1111 203.0.113.1
nmap -Pn --host-timeout 100 --max-retries 0 -p 2222 203.0.113.1
nmap -Pn --host-timeout 100 --max-retries 0 -p 3333 203.0.113.1
\`\`\`

**از ویندوز (PowerShell):**
\`\`\`powershell
$ip = "203.0.113.1"
foreach ($port in 1111,2222,3333) {
    try { [System.Net.Sockets.TcpClient]::new($ip, $port) } catch {}
    Start-Sleep -Milliseconds 200
}
\`\`\`

### تأیید عملکرد

بعد از knock، بررسی کنید IP شما در لیست مجاز است:
\`\`\`
/ip firewall address-list print where list=knock_allowed
\`\`\`

### نکات مهم

- Port knocking **امنیت از طریق مبهم‌سازی** است — مهاجمان را تأخیر می‌دهد اما جایگزین رمزهای قوی یا احراز هویت SSH با کلید نمی‌شود.
- برای امنیت حداکثری آن را با احراز هویت کلید SSH ترکیب کنید.
- در محیط تولید از شماره پورت‌های تصادفی بالا استفاده کنید (نه ۱۱۱۱ و ۲۲۲۲).`,
  },
  'mikrotik-firewall-hardening-checklist': {
    contentEn: `## MikroTik Firewall Hardening Checklist

A newly configured MikroTik device — even with IP addresses and routing set up — is not secure by default. This post gives you a complete hardening checklist that you can apply to any MikroTik router.

### 1. Set a Strong Admin Password

\`\`\`
/user set [find name=admin] password=V3ryStr0ng!P@ss
\`\`\`

Or create a new admin and disable the default:
\`\`\`
/user add name=netadmin password=V3ryStr0ng!P@ss group=full
/user disable admin
\`\`\`

### 2. Disable Unused Services

Turn off every service you do not actively use:

\`\`\`
/ip service
set telnet disabled=yes
set ftp disabled=yes
set www disabled=yes       # WebFig HTTP — use HTTPS instead
set api disabled=yes
set api-ssl disabled=yes   # Enable only if you use API
set ssh port=2222          # Change from default 22
set www-ssl port=4443      # Change HTTPS port
\`\`\`

### 3. Restrict Services to Management IP

Bind each active service to your management IP only:

\`\`\`
/ip service
set ssh address=192.168.88.0/24
set www-ssl address=192.168.88.0/24
set winbox address=192.168.88.0/24
\`\`\`

### 4. Baseline Firewall Input Chain

This is the core protection for the router itself:

\`\`\`
/ip firewall filter

# Allow established/related (keep existing sessions working)
add chain=input connection-state=established,related action=accept

# Drop invalid packets
add chain=input connection-state=invalid action=drop

# Allow ICMP ping (optional — remove to hide the router)
add chain=input protocol=icmp action=accept

# Allow management from LAN only
add chain=input src-address=192.168.88.0/24 action=accept

# Drop everything else to input
add chain=input action=drop comment="Default deny input"
\`\`\`

### 5. Baseline Firewall Forward Chain

Protect traffic forwarded through the router:

\`\`\`
/ip firewall filter
add chain=forward connection-state=established,related action=accept
add chain=forward connection-state=invalid action=drop
# Add specific allow rules here for your network
add chain=forward action=drop comment="Default deny forward"
\`\`\`

### 6. Disable Neighbor Discovery (if not needed)

MikroTik's **Neighbor Discovery Protocol (MNDP)** announces the device on the network. Disable on WAN:

\`\`\`
/ip neighbor discovery-settings set discover-interface-list=LAN
\`\`\`

### 7. Disable MAC Server on WAN

MAC-based Winbox access should only work on LAN:

\`\`\`
/tool mac-server set allowed-interface-list=LAN
/tool mac-server ping set enabled=no
\`\`\`

### 8. Disable Bandwidth Test Server

\`\`\`
/tool bandwidth-server set enabled=no
\`\`\`

### 9. Enable Firewall for Bridge Traffic

If using bridges, enable firewall processing for bridged packets:

\`\`\`
/bridge settings set use-ip-firewall=yes
\`\`\`

### 10. Secure DNS

If not running a public DNS server, restrict DNS queries:

\`\`\`
/ip dns set allow-remote-requests=no
\`\`\`

### 11. Protect Against Common Attacks

\`\`\`
/ip firewall filter
# Block port scanners
add chain=input protocol=tcp psd=21,3s,3,1 action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w
add chain=input src-address-list=port-scanners action=drop

# Block invalid TCP flags
add chain=input protocol=tcp tcp-flags=!fin,!syn,!rst,!ack action=drop
\`\`\`

### 12. Enable Strong Crypto for SSH and Winbox

\`\`\`
/ip ssh set strong-crypto=yes
\`\`\`

### Hardening Verification Checklist

After applying:
\`\`\`
/ip service print                    # Verify disabled services
/ip firewall filter print            # Verify filter rules
/tool mac-server print               # Verify MAC server restricted
/ip neighbor discovery-settings print # Verify discovery restricted
/ip dns print                        # Verify remote requests disabled
\`\`\`

Save config immediately after hardening:
\`\`\`
/system backup save name=post-hardening
\`\`\``,
    contentFa: `## چک‌لیست سخت‌افزاری فایروال میکروتیک

یک دستگاه میکروتیک تازه پیکربندی‌شده — حتی با آی‌پی و روتینگ تنظیم‌شده — به‌طور پیش‌فرض امن نیست. این پست یک چک‌لیست کامل hardening ارائه می‌دهد که می‌توانید روی هر روتر میکروتیک اعمال کنید.

### ۱. تنظیم رمز عبور قوی برای ادمین

\`\`\`
/user set [find name=admin] password=V3ryStr0ng!P@ss
\`\`\`

یا یک ادمین جدید بسازید و admin پیش‌فرض را غیرفعال کنید:
\`\`\`
/user add name=netadmin password=V3ryStr0ng!P@ss group=full
/user disable admin
\`\`\`

### ۲. غیرفعال کردن سرویس‌های استفاده‌نشده

هر سرویسی که فعالانه استفاده نمی‌کنید را خاموش کنید:

\`\`\`
/ip service
set telnet disabled=yes
set ftp disabled=yes
set www disabled=yes
set api disabled=yes
set api-ssl disabled=yes
set ssh port=2222
set www-ssl port=4443
\`\`\`

### ۳. محدود کردن سرویس‌ها به IP مدیریتی

هر سرویس فعال را فقط به IP مدیریتی شما متصل کنید:

\`\`\`
/ip service
set ssh address=192.168.88.0/24
set www-ssl address=192.168.88.0/24
set winbox address=192.168.88.0/24
\`\`\`

### ۴. فایروال پایه برای Input Chain

\`\`\`
/ip firewall filter

# قبول established/related
add chain=input connection-state=established,related action=accept

# Drop پکت‌های invalid
add chain=input connection-state=invalid action=drop

# قبول ICMP
add chain=input protocol=icmp action=accept

# قبول مدیریت فقط از LAN
add chain=input src-address=192.168.88.0/24 action=accept

# Drop همه بقیه
add chain=input action=drop comment="Default deny input"
\`\`\`

### ۵. فایروال پایه برای Forward Chain

\`\`\`
/ip firewall filter
add chain=forward connection-state=established,related action=accept
add chain=forward connection-state=invalid action=drop
add chain=forward action=drop comment="Default deny forward"
\`\`\`

### ۶. غیرفعال کردن Neighbor Discovery روی WAN

\`\`\`
/ip neighbor discovery-settings set discover-interface-list=LAN
\`\`\`

### ۷. غیرفعال کردن MAC Server روی WAN

\`\`\`
/tool mac-server set allowed-interface-list=LAN
/tool mac-server ping set enabled=no
\`\`\`

### ۸. غیرفعال کردن Bandwidth Test Server

\`\`\`
/tool bandwidth-server set enabled=no
\`\`\`

### ۹. محدود کردن DNS

\`\`\`
/ip dns set allow-remote-requests=no
\`\`\`

### ۱۰. فعال کردن رمزنگاری قوی برای SSH

\`\`\`
/ip ssh set strong-crypto=yes
\`\`\`

### تأیید بعد از Hardening

\`\`\`
/ip service print
/ip firewall filter print
/tool mac-server print
/ip dns print
\`\`\`

فوراً بعد از hardening پیکربندی را ذخیره کنید:
\`\`\`
/system backup save name=post-hardening
\`\`\``,
  },
  'mikrotik-ddos-protection-scripts': {
    contentEn: `## DDoS Protection Scripts for MikroTik

MikroTik RouterOS can be configured to detect and mitigate volumetric DDoS attacks. This post covers practical scripts and rules you can deploy immediately.

### Understanding DDoS on MikroTik

When a DDoS attack hits your router:
- CPU spikes to 100%
- Legitimate traffic is dropped
- The router may become unresponsive

RouterOS can't stop a true volumetric attack at the link level, but it can protect itself and route traffic more intelligently.

### 1. Block Fragmented Packets

DDoS attacks often use fragmented IP packets to overwhelm the router:

\`\`\`
/ip firewall filter
add chain=input protocol=udp dst-port=0-65535 fragment=yes action=drop comment="Drop fragmented UDP"
add chain=input protocol=tcp fragment=yes action=drop comment="Drop fragmented TCP"
\`\`\`

### 2. Connection Rate Limiting

Limit the number of new connections per second from a single IP:

\`\`\`
/ip firewall filter
add chain=input connection-state=new action=jump jump-target=conn-rate-limit
/ip firewall filter
add chain=conn-rate-limit src-address-list=conn-flood action=drop
add chain=conn-rate-limit action=add-src-to-address-list address-list=conn-flood address-list-timeout=5m limit=20,10:packet
add chain=conn-rate-limit action=accept
\`\`\`

Explanation: If a single IP creates more than 20 new connections in 10 seconds, it gets blacklisted for 5 minutes.

### 3. ICMP Flood Protection

\`\`\`
/ip firewall filter
add chain=input protocol=icmp icmp-options=8:0 action=jump jump-target=icmp-rate
/ip firewall filter
add chain=icmp-rate src-address-list=icmp-flood action=drop
add chain=icmp-rate action=add-src-to-address-list address-list=icmp-flood address-list-timeout=5m limit=10,5:packet
add chain=icmp-rate action=accept
\`\`\`

### 4. SYN Flood Protection

SYN floods exploit the TCP handshake. Detect and block them:

\`\`\`
/ip firewall filter
add chain=input protocol=tcp tcp-flags=syn connection-state=new action=jump jump-target=syn-protect
/ip firewall filter
add chain=syn-protect src-address-list=syn-flood action=drop
add chain=syn-protect action=add-src-to-address-list address-list=syn-flood address-list-timeout=10m limit=50,5:packet
add chain=syn-protect action=accept
\`\`\`

### 5. UDP Flood Protection

\`\`\`
/ip firewall filter
add chain=input protocol=udp action=jump jump-target=udp-protect
/ip firewall filter
add chain=udp-protect src-address-list=udp-flood action=drop
add chain=udp-protect action=add-src-to-address-list address-list=udp-flood address-list-timeout=10m limit=100,50:packet
add chain=udp-protect action=accept
\`\`\`

### 6. Block Bogon IP Addresses

Bogons are IP ranges that should never appear on the internet. Block them at input:

\`\`\`
/ip firewall address-list
add list=bogons address=0.0.0.0/8
add list=bogons address=10.0.0.0/8
add list=bogons address=100.64.0.0/10
add list=bogons address=127.0.0.0/8
add list=bogons address=169.254.0.0/16
add list=bogons address=172.16.0.0/12
add list=bogons address=192.0.0.0/24
add list=bogons address=192.168.0.0/16
add list=bogons address=198.18.0.0/15
add list=bogons address=240.0.0.0/4

/ip firewall filter
add chain=input src-address-list=bogons action=drop comment="Drop bogon sources"
add chain=forward src-address-list=bogons action=drop
\`\`\`

### 7. Automatic DDoS Detection Script

This script monitors connection counts and alerts you:

\`\`\`
/system script
add name=ddos-check source={
    :local conns [/ip firewall connection print count-only]
    :if ($conns > 5000) do={
        /log warning "DDoS suspected: $conns active connections"
        /tool e-mail send to="admin@example.com" subject="DDoS Alert" body="$conns connections active on router"
    }
}

/system scheduler
add name=ddos-monitor interval=1m on-event=ddos-check
\`\`\`

### 8. CPU Protection — Drop if Overloaded

\`\`\`
/ip firewall filter
add chain=input action=drop comment="Overload protection" disabled=yes
\`\`\`

During an attack you can temporarily enable this rule to drop all non-essential input traffic, protecting the router's CPU while you investigate.

### Testing Your Rules

Check address lists to see if IPs are being flagged:
\`\`\`
/ip firewall address-list print where list~"flood"
\`\`\`

Check connection count:
\`\`\`
/ip firewall connection print count-only
\`\`\`

Monitor CPU:
\`\`\`
/system resource print
\`\`\``,
    contentFa: `## اسکریپت‌های محافظت در برابر DDoS برای میکروتیک

RouterOS میکروتیک می‌تواند برای شناسایی و کاهش حملات DDoS حجمی پیکربندی شود. این پست اسکریپت‌ها و قوانین عملی را که می‌توانید فوراً اجرا کنید پوشش می‌دهد.

### ۱. مسدود کردن بسته‌های Fragmented

حملات DDoS اغلب از بسته‌های IP fragmented استفاده می‌کنند:

\`\`\`
/ip firewall filter
add chain=input protocol=udp dst-port=0-65535 fragment=yes action=drop comment="Drop fragmented UDP"
add chain=input protocol=tcp fragment=yes action=drop comment="Drop fragmented TCP"
\`\`\`

### ۲. محدود کردن نرخ اتصال

تعداد اتصالات جدید در ثانیه از یک IP را محدود کنید:

\`\`\`
/ip firewall filter
add chain=input connection-state=new action=jump jump-target=conn-rate-limit
/ip firewall filter
add chain=conn-rate-limit src-address-list=conn-flood action=drop
add chain=conn-rate-limit action=add-src-to-address-list address-list=conn-flood address-list-timeout=5m limit=20,10:packet
add chain=conn-rate-limit action=accept
\`\`\`

### ۳. محافظت در برابر ICMP Flood

\`\`\`
/ip firewall filter
add chain=input protocol=icmp icmp-options=8:0 action=jump jump-target=icmp-rate
/ip firewall filter
add chain=icmp-rate src-address-list=icmp-flood action=drop
add chain=icmp-rate action=add-src-to-address-list address-list=icmp-flood address-list-timeout=5m limit=10,5:packet
add chain=icmp-rate action=accept
\`\`\`

### ۴. محافظت در برابر SYN Flood

\`\`\`
/ip firewall filter
add chain=input protocol=tcp tcp-flags=syn connection-state=new action=jump jump-target=syn-protect
/ip firewall filter
add chain=syn-protect src-address-list=syn-flood action=drop
add chain=syn-protect action=add-src-to-address-list address-list=syn-flood address-list-timeout=10m limit=50,5:packet
add chain=syn-protect action=accept
\`\`\`

### ۵. محافظت در برابر UDP Flood

\`\`\`
/ip firewall filter
add chain=input protocol=udp action=jump jump-target=udp-protect
/ip firewall filter
add chain=udp-protect src-address-list=udp-flood action=drop
add chain=udp-protect action=add-src-to-address-list address-list=udp-flood address-list-timeout=10m limit=100,50:packet
add chain=udp-protect action=accept
\`\`\`

### ۶. مسدود کردن IPهای Bogon

\`\`\`
/ip firewall address-list
add list=bogons address=0.0.0.0/8
add list=bogons address=10.0.0.0/8
add list=bogons address=127.0.0.0/8
add list=bogons address=169.254.0.0/16
add list=bogons address=172.16.0.0/12
add list=bogons address=192.168.0.0/16
add list=bogons address=240.0.0.0/4

/ip firewall filter
add chain=input src-address-list=bogons action=drop comment="Drop bogon sources"
add chain=forward src-address-list=bogons action=drop
\`\`\`

### ۷. اسکریپت تشخیص خودکار DDoS

\`\`\`
/system script
add name=ddos-check source={
    :local conns [/ip firewall connection print count-only]
    :if ($conns > 5000) do={
        /log warning "DDoS suspected: $conns active connections"
    }
}

/system scheduler
add name=ddos-monitor interval=1m on-event=ddos-check
\`\`\`

### بررسی قوانین

\`\`\`
/ip firewall address-list print where list~"flood"
/ip firewall connection print count-only
/system resource print
\`\`\``,
  },
  'mikrotik-chimay-blue-vulnerability': {
    contentEn: `## CVE-2018-14847: The Chimay Blue MikroTik Vulnerability

In April 2018, a WikiLeaks release called "Vault 7" exposed a CIA exploit for MikroTik routers. This exploit, later publicly known as **Chimay Blue**, targets a critical vulnerability in the Winbox protocol that allows unauthenticated remote attackers to read arbitrary files from RouterOS — including the user database.

### What Is CVE-2018-14847?

- **Type**: Authentication bypass / arbitrary file read
- **Protocol**: Winbox (port 8291)
- **Affected versions**: RouterOS below 6.42.1 (Long-term), 6.43 (Stable)
- **Authentication required**: None — fully unauthenticated
- **Impact**: Attacker reads \`/flash/rw/store/user.dat\` — the credential database — exposing all usernames and passwords in plaintext

### How the Exploit Works (Technical Overview)

The Winbox protocol has a message-based API. CVE-2018-14847 exploits a flaw in how Winbox message handler \`ecos.mvc\` processes certain message types:

1. Attacker sends a specially crafted Winbox message without authenticating.
2. The handler processes it as if the user were already authenticated.
3. The attacker requests the file \`/flash/rw/store/user.dat\`.
4. RouterOS returns the file content — which contains all user credentials.

Public proof-of-concept code was released within days of the WikiLeaks disclosure. Tools like **Chimay-Blue** on GitHub implement the exploit as a Python script.

### How to Check If Your Device Is Vulnerable

From the router CLI:
\`\`\`
/system routeros print
\`\`\`

If the version is below **6.42.1** (for Long-term track) or **6.43** (for Stable track), the device is vulnerable.

From an external tool, attackers use:
\`\`\`bash
python3 chimay-blue.py 192.168.1.1
\`\`\`

A vulnerable device returns credential data immediately.

### Immediate Remediation — Upgrade RouterOS

This is the only true fix:

\`\`\`
/system package update set channel=long-term
/system package update check-for-updates
/system package update install
\`\`\`

The device reboots after installation. Verify afterward:
\`\`\`
/system routeros print
\`\`\`

### Additional Mitigations

**1. Block Winbox from WAN immediately:**
\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 src-address=!192.168.88.0/24 action=drop comment="Block Winbox from WAN"
\`\`\`

**2. If you cannot patch immediately — disable Winbox:**
\`\`\`
/ip service set winbox disabled=yes
\`\`\`

Then use SSH or WebFig (HTTPS) for management.

**3. Check if you were already compromised:**

Look for unknown scheduled tasks, scripts, or firewall rules:
\`\`\`
/system scheduler print
/system script print
/ip firewall filter print
/ip socks print       # SOCKS proxy — sign of Mēris botnet infection
\`\`\`

Check for unknown users:
\`\`\`
/user print
\`\`\`

If you find SOCKS proxy enabled or unknown scripts, the device has likely been compromised. **Perform a full netinstall (clean install) rather than just upgrading.**

### The Mēris Botnet Connection

In 2021, researchers found that devices exploited via CVE-2018-14847 were being recruited into the **Mēris botnet** — a massive DDoS-as-a-service platform. Infected devices had:
- SOCKS4 proxies enabled on port 5678
- Persistent scripts surviving reboots
- Scheduled tasks calling out to C2 servers

### Lessons Learned

1. Keep RouterOS updated — this exploit was patched in April 2018 but millions of devices ran unpatched for years.
2. **Never expose Winbox to the internet.**
3. Monitor for unexpected configuration changes.
4. Segment management traffic to a dedicated VLAN.`,
    contentFa: `## CVE-2018-14847: آسیب‌پذیری Chimay Blue در میکروتیک

در آوریل ۲۰۱۸، یک افشاگری WikiLeaks با نام "Vault 7" یک اکسپلویت سیا برای روترهای میکروتیک را فاش کرد. این اکسپلویت، که بعداً با نام **Chimay Blue** شناخته شد، یک آسیب‌پذیری بحرانی در پروتکل Winbox را هدف قرار می‌دهد که به مهاجمان از راه دور بدون احراز هویت اجازه می‌دهد فایل‌های دلخواه از RouterOS را بخوانند — از جمله پایگاه داده کاربران.

### CVE-2018-14847 چیست؟

- **نوع**: دور زدن احراز هویت / خواندن فایل دلخواه
- **پروتکل**: Winbox (پورت ۸۲۹۱)
- **نسخه‌های آسیب‌پذیر**: RouterOS زیر 6.42.1 (Long-term)، 6.43 (Stable)
- **احراز هویت موردنیاز**: هیچ — کاملاً بدون احراز هویت
- **تأثیر**: مهاجم فایل \`/flash/rw/store/user.dat\` را می‌خواند — پایگاه داده اعتبارنامه — که همه نام‌های کاربری و رمزهای عبور را به‌صورت متن ساده افشا می‌کند

### بررسی آسیب‌پذیر بودن دستگاه

از CLI روتر:
\`\`\`
/system routeros print
\`\`\`

اگر نسخه زیر **6.42.1** (برای Long-term) یا **6.43** (برای Stable) است، دستگاه آسیب‌پذیر است.

### رفع فوری — ارتقاء RouterOS

این تنها راه‌حل واقعی است:

\`\`\`
/system package update set channel=long-term
/system package update check-for-updates
/system package update install
\`\`\`

### اقدامات کاهش ریسک اضافی

**۱. مسدود کردن فوری Winbox از WAN:**
\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 src-address=!192.168.88.0/24 action=drop comment="Block Winbox from WAN"
\`\`\`

**۲. اگر نمی‌توانید فوری وصله بزنید — Winbox را غیرفعال کنید:**
\`\`\`
/ip service set winbox disabled=yes
\`\`\`

**۳. بررسی اینکه آیا قبلاً مورد نفوذ قرار گرفته‌اید:**

دنبال task، اسکریپت یا قوانین فایروال ناشناخته بگردید:
\`\`\`
/system scheduler print
/system script print
/ip firewall filter print
/ip socks print
\`\`\`

کاربران ناشناخته را بررسی کنید:
\`\`\`
/user print
\`\`\`

اگر پروکسی SOCKS فعال یا اسکریپت‌های ناشناخته پیدا کردید، دستگاه احتمالاً مورد نفوذ قرار گرفته. **به جای صرفاً ارتقاء، یک netinstall کامل (نصب تمیز) انجام دهید.**

### ارتباط با بات‌نت Mēris

در سال ۲۰۲۱، محققان متوجه شدند دستگاه‌هایی که از طریق CVE-2018-14847 اکسپلویت شده بودند به بات‌نت **Mēris** جذب می‌شوند. دستگاه‌های آلوده داشتند:
- پروکسی‌های SOCKS4 فعال روی پورت ۵۶۷۸
- اسکریپت‌های ماندگار که از ریبوت جان سالم به در می‌بردند
- Task های زمان‌بندی‌شده که با سرورهای C2 ارتباط برقرار می‌کردند

### درس‌های آموخته‌شده

۱. RouterOS را به‌روز نگه دارید.
۲. **هرگز Winbox را در اینترنت expose نکنید.**
۳. تغییرات پیکربندی غیرمنتظره را رصد کنید.
۴. ترافیک مدیریتی را در یک VLAN اختصاصی ایزوله کنید.`,
  },
  'mikrotik-winbox-exploit-protection': {
    contentEn: `## Protecting MikroTik Against Winbox Exploits

Winbox is the native MikroTik GUI client that communicates over a proprietary protocol on TCP port 8291. While convenient, it has been the attack surface for several critical vulnerabilities. This post covers how to protect your devices.

### Why Winbox Is a Risk

- Port 8291 is specific to MikroTik — instantly identifies your device as a MikroTik to any scanner.
- Historical exploits (CVE-2018-14847) targeted the Winbox protocol directly.
- Brute force attacks against Winbox authentication are common.
- Older Winbox clients transmitted credentials with weak encryption.

### Immediate Protections

**1. Block Winbox from the Internet (WAN)**

This is non-negotiable. Winbox should never be reachable from the WAN:

\`\`\`
/ip firewall filter
add chain=input in-interface=ether1-wan protocol=tcp dst-port=8291 action=drop comment="Block Winbox from WAN"
\`\`\`

Or using address-based approach (allow only LAN):
\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 src-address=!192.168.0.0/16 action=drop comment="Winbox LAN only"
\`\`\`

**2. Restrict Winbox to Specific Management IPs**

\`\`\`
/ip service set winbox address=192.168.88.10/32
\`\`\`

This tells RouterOS to only respond to Winbox connections from 192.168.88.10.

**3. Change the Winbox Port**

Winbox port can be changed to confuse automated scanners:
\`\`\`
/ip service set winbox port=18291
\`\`\`

Then connect in Winbox using \`192.168.1.1:18291\`.

**4. Keep RouterOS Patched**

All known Winbox exploits have been patched in updated versions. Maintain the latest release:
\`\`\`
/system package update install
\`\`\`

**5. Use HTTPS (WebFig) or SSH Instead**

For remote management consider disabling Winbox entirely and using encrypted alternatives:

\`\`\`
/ip service set winbox disabled=yes
/ip service set www-ssl disabled=no address=203.0.113.10/32
\`\`\`

WebFig over HTTPS is strongly encrypted and less attack-surface than Winbox.

### Detecting Winbox Brute Force

Monitor your logs for repeated Winbox connection failures:

\`\`\`
/log print where message~"winbox"
\`\`\`

Add a brute force detection rule (see the brute force post for full config):

\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 src-address-list=winbox_blacklist action=drop
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage3 action=add-src-to-address-list address-list=winbox_blacklist address-list-timeout=10d
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage2 action=add-src-to-address-list address-list=wb_stage3 address-list-timeout=1m
add chain=input protocol=tcp dst-port=8291 src-address-list=wb_stage1 action=add-src-to-address-list address-list=wb_stage2 address-list-timeout=1m
add chain=input protocol=tcp dst-port=8291 connection-state=new action=add-src-to-address-list address-list=wb_stage1 address-list-timeout=1m
\`\`\`

### Use the Latest Winbox Client

Old Winbox clients (v2.x) lack modern encryption. Always download the latest Winbox binary from the MikroTik official site or from your router:

\`\`\`
http://192.168.88.1/winbox/WinBox.exe
\`\`\`

The latest Winbox (v3.x and v4.x) uses stronger session encryption.

### VPN-Only Management (Best Practice)

The most secure approach for remote management:

1. Configure a WireGuard or IPsec VPN on the router.
2. **Do not expose any management port** (SSH, Winbox, WebFig) to the internet.
3. Connect via VPN first, then manage the router as if you are on the LAN.

\`\`\`
# After WireGuard is configured, restrict all management to VPN subnet
/ip service set winbox address=10.0.0.0/24   # VPN subnet only
/ip service set ssh address=10.0.0.0/24
\`\`\`

### Summary

| Protection | Priority |
|------------|----------|
| Block Winbox from WAN | Critical |
| Restrict Winbox to management IP | High |
| Keep RouterOS updated | High |
| Brute force detection rules | High |
| Change Winbox port | Medium |
| Use VPN for remote management | Best Practice |`,
    contentFa: `## محافظت از میکروتیک در برابر اکسپلویت‌های Winbox

Winbox کلاینت GUI بومی میکروتیک است که از طریق یک پروتکل اختصاصی روی پورت TCP 8291 ارتباط برقرار می‌کند. این پورت چندین آسیب‌پذیری بحرانی داشته. این پست نشان می‌دهد چطور دستگاه‌های خود را محافظت کنید.

### محافظت‌های فوری

**۱. مسدود کردن Winbox از اینترنت (WAN)**

این غیرقابل معامله است. Winbox هرگز نباید از WAN قابل دسترس باشد:

\`\`\`
/ip firewall filter
add chain=input in-interface=ether1-wan protocol=tcp dst-port=8291 action=drop comment="Block Winbox from WAN"
\`\`\`

**۲. محدود کردن Winbox به IPهای مدیریتی خاص**

\`\`\`
/ip service set winbox address=192.168.88.10/32
\`\`\`

**۳. تغییر پورت Winbox**

\`\`\`
/ip service set winbox port=18291
\`\`\`

**۴. نگه‌داشتن RouterOS در آخرین نسخه**

\`\`\`
/system package update install
\`\`\`

**۵. استفاده از HTTPS یا SSH به جای Winbox**

برای مدیریت از راه دور، در نظر بگیرید Winbox را کاملاً غیرفعال کنید:

\`\`\`
/ip service set winbox disabled=yes
/ip service set www-ssl disabled=no address=203.0.113.10/32
\`\`\`

### مدیریت فقط از طریق VPN (بهترین روش)

امن‌ترین رویکرد برای مدیریت از راه دور:

۱. یک VPN WireGuard یا IPsec روی روتر پیکربندی کنید.
۲. **هیچ پورت مدیریتی را** در اینترنت expose نکنید.
۳. ابتدا از طریق VPN وصل شوید، سپس روتر را مثل اینکه روی LAN هستید مدیریت کنید.

\`\`\`
/ip service set winbox address=10.0.0.0/24
/ip service set ssh address=10.0.0.0/24
\`\`\`

### خلاصه

| محافظت | اولویت |
|--------|--------|
| مسدود کردن Winbox از WAN | بحرانی |
| محدود کردن به IP مدیریتی | بالا |
| به‌روز نگه داشتن RouterOS | بالا |
| قوانین تشخیص brute force | بالا |
| تغییر پورت Winbox | متوسط |
| استفاده از VPN برای مدیریت از راه دور | بهترین روش |`,
  },
  'mikrotik-intrusion-detection-logs': {
    contentEn: `## Using MikroTik Logs for Intrusion Detection

RouterOS has a powerful logging system. By configuring it properly, you can detect intrusion attempts, unauthorized access, and suspicious activity — all from the router's own logs.

### How RouterOS Logging Works

Logs are generated by **topics** and can be sent to multiple **targets**:
- **Memory** (default, limited to ~150 entries)
- **Disk** (flash storage — use sparingly on routers with limited flash)
- **Remote Syslog server** (recommended for production)
- **Email**

### Setting Up Remote Syslog

Forward all logs to a central syslog server (e.g., running rsyslog or Graylog):

\`\`\`
/system logging action
add name=remote-syslog target=remote remote=192.168.88.200 remote-port=514 src-address=0.0.0.0 bsd-syslog=yes syslog-facility=local0

/system logging
add topics=info action=remote-syslog
add topics=warning action=remote-syslog
add topics=error action=remote-syslog
add topics=critical action=remote-syslog
\`\`\`

### Key Log Topics for Security

| Topic | What It Shows |
|-------|---------------|
| \`system\` | Login attempts, config changes |
| \`account\` | Successful and failed logins |
| \`firewall\` | Matched firewall rules |
| \`manager\` | Winbox session events |
| \`pptp,l2tp,ipsec\` | VPN connection events |

### Enable Firewall Rule Logging

Add \`log=yes\` and \`log-prefix\` to critical firewall rules:

\`\`\`
/ip firewall filter
add chain=input action=drop log=yes log-prefix="INPUT-DROP:" comment="Log all dropped input"
add chain=input src-address-list=ssh_blacklist protocol=tcp dst-port=22 action=drop log=yes log-prefix="SSH-BLACKLIST:"
\`\`\`

Now every dropped packet generates a log entry.

### Log Analysis: What to Look For

**Failed login attempts:**
\`\`\`
/log print where message~"login failure"
\`\`\`

Output example:
\`\`\`
10:23:45 account,info: netadmin failed to log in from 1.2.3.4 via ssh
\`\`\`

**Firewall drops:**
\`\`\`
/log print where message~"INPUT-DROP"
\`\`\`

**Winbox connection events:**
\`\`\`
/log print where message~"winbox"
\`\`\`

**Configuration changes (very important):**
\`\`\`
/log print where topics~"system"
\`\`\`

This shows every config change — who made it, what was changed, when.

### Detect Unauthorized Config Changes

Create a script that checks for new scripts, users, or scheduler entries:

\`\`\`
/system script
add name=sec-audit source={
    :local userCount [/user print count-only]
    :local scriptCount [/system script print count-only]
    :local schedCount [/system scheduler print count-only]
    /log info message="SEC-AUDIT: users=$userCount scripts=$scriptCount schedulers=$schedCount"
}

/system scheduler add name=sec-audit interval=15m on-event=sec-audit
\`\`\`

If counts suddenly increase, investigate immediately.

### Email Alerts on Critical Events

\`\`\`
/system logging action
add name=email-critical target=email email=admin@example.com

/system logging
add topics=critical action=email-critical
add topics=error action=email-critical
\`\`\`

Configure email settings first:
\`\`\`
/tool e-mail set server=smtp.example.com port=587 from=router@example.com user=user password=pass
\`\`\`

### Log Firewall Hits by Address List

Log when an IP hits your brute force blacklist:

\`\`\`
/ip firewall filter
add chain=input src-address-list=ssh_blacklist protocol=tcp dst-port=22 action=drop log=yes log-prefix="BLACKLIST-HIT:"
\`\`\`

Then monitor:
\`\`\`
/log print where message~"BLACKLIST-HIT"
\`\`\`

### Exporting Logs

For compliance or long-term analysis, export logs:

\`\`\`
/log print file=security-log
\`\`\`

This writes the log to a file you can download via FTP or SCP.

### Summary: Intrusion Detection Checklist

- [ ] Remote syslog server configured
- [ ] \`account\` and \`system\` topics forwarded to syslog
- [ ] Firewall drop rules have \`log=yes\`
- [ ] Email alerts for critical events
- [ ] Regular log review scheduled
- [ ] Baseline script monitoring unexpected config changes`,
    contentFa: `## استفاده از لاگ‌های میکروتیک برای تشخیص نفوذ

RouterOS سیستم لاگ‌گیری قدرتمندی دارد. با پیکربندی صحیح آن، می‌توانید تلاش‌های نفوذ، دسترسی‌های غیرمجاز و فعالیت‌های مشکوک را — همه از لاگ‌های خود روتر — شناسایی کنید.

### تنظیم Remote Syslog

همه لاگ‌ها را به یک سرور syslog مرکزی ارسال کنید:

\`\`\`
/system logging action
add name=remote-syslog target=remote remote=192.168.88.200 remote-port=514 bsd-syslog=yes syslog-facility=local0

/system logging
add topics=info action=remote-syslog
add topics=warning action=remote-syslog
add topics=error action=remote-syslog
add topics=critical action=remote-syslog
\`\`\`

### فعال کردن لاگ‌گیری قوانین فایروال

\`log=yes\` و \`log-prefix\` را به قوانین فایروال بحرانی اضافه کنید:

\`\`\`
/ip firewall filter
add chain=input action=drop log=yes log-prefix="INPUT-DROP:"
add chain=input src-address-list=ssh_blacklist protocol=tcp dst-port=22 action=drop log=yes log-prefix="SSH-BLACKLIST:"
\`\`\`

### تجزیه و تحلیل لاگ: چه چیزی باید جستجو کرد

**تلاش‌های ناموفق ورود:**
\`\`\`
/log print where message~"login failure"
\`\`\`

**Drop های فایروال:**
\`\`\`
/log print where message~"INPUT-DROP"
\`\`\`

**تغییرات پیکربندی:**
\`\`\`
/log print where topics~"system"
\`\`\`

### شناسایی تغییرات پیکربندی غیرمجاز

یک اسکریپت بسازید که کاربران، اسکریپت‌ها یا scheduler جدید را بررسی کند:

\`\`\`
/system script
add name=sec-audit source={
    :local userCount [/user print count-only]
    :local scriptCount [/system script print count-only]
    :local schedCount [/system scheduler print count-only]
    /log info message="SEC-AUDIT: users=$userCount scripts=$scriptCount schedulers=$schedCount"
}

/system scheduler add name=sec-audit interval=15m on-event=sec-audit
\`\`\`

### هشدارهای ایمیل برای رویدادهای بحرانی

\`\`\`
/system logging action
add name=email-critical target=email email=admin@example.com

/system logging
add topics=critical action=email-critical
add topics=error action=email-critical
\`\`\`

### چک‌لیست تشخیص نفوذ

- [ ] سرور syslog از راه دور پیکربندی شده
- [ ] موضوعات \`account\` و \`system\` به syslog ارسال می‌شوند
- [ ] قوانین drop فایروال \`log=yes\` دارند
- [ ] هشدارهای ایمیل برای رویدادهای بحرانی
- [ ] بررسی منظم لاگ برنامه‌ریزی شده`,
  },
  'mikrotik-vpn-security-hardening': {
    contentEn: `## VPN Security Hardening on MikroTik

VPNs are only as secure as how they are configured. A poorly secured VPN endpoint can be exploited just as easily as any other exposed service. This post covers hardening for the VPN types most commonly used on MikroTik.

### WireGuard Security Hardening

WireGuard is the most secure and modern VPN option in RouterOS v7.

**Generate strong keys:**
WireGuard keys are generated automatically when you create the interface — no configuration needed. Never share the private key.

**Restrict the listening port:**
\`\`\`
/interface wireguard
add name=wg-vpn listen-port=13231 private-key="<auto-generated>"
\`\`\`

Choose a non-standard port (not 51820, the default, which scanners look for).

**Bind peers to specific IPs:**
\`\`\`
/interface wireguard peers
add interface=wg-vpn public-key="peer-pub-key" allowed-address=10.0.0.2/32 endpoint-address=0.0.0.0 endpoint-port=0
\`\`\`

\`allowed-address=10.0.0.2/32\` means only that specific VPN IP can authenticate with that key.

**Firewall rules for WireGuard:**
\`\`\`
/ip firewall filter
add chain=input protocol=udp dst-port=13231 action=accept comment="WireGuard"
add chain=input in-interface=wg-vpn action=accept comment="Allow VPN traffic"
\`\`\`

### IPsec IKEv2 Security Hardening

**Use strong proposal settings:**
\`\`\`
/ip ipsec proposal
set default auth-algorithms=sha256 enc-algorithms=aes-256-cbc pfs-group=modp2048

/ip ipsec profile
set default dh-group=modp2048 enc-algorithm=aes-256 hash-algorithm=sha256 dpd-interval=30s dpd-maximum-failures=5
\`\`\`

**Avoid weak algorithms — disable these:**
\`\`\`
/ip ipsec proposal
set default enc-algorithms=aes-256-cbc  # Remove 3des, aes-128, etc.
\`\`\`

**Use certificate-based auth instead of PSK (pre-shared key):**

PSKs can be brute-forced if weak. Certificates provide stronger authentication:
\`\`\`
/ip ipsec peer
set [find] auth-method=rsa-signature
\`\`\`

**IP source filtering — only allow VPN from expected regions:**
\`\`\`
/ip firewall filter
add chain=input protocol=udp dst-port=500,4500 src-address-list=allowed-vpn-sources action=accept
add chain=input protocol=udp dst-port=500,4500 action=drop
\`\`\`

### PPTP/L2TP Security Notes

**PPTP is deprecated — avoid it:**
PPTP uses MPPE which has known cryptographic weaknesses. MS-CHAPv2 (the authentication protocol) can be cracked offline. If you have PPTP, migrate to L2TP+IPsec or WireGuard.

**If you must use L2TP, always require IPsec:**
\`\`\`
/interface l2tp-server server
set enabled=yes use-ipsec=required ipsec-secret=VeryStr0ngSecret123!
\`\`\`

\`use-ipsec=required\` rejects any L2TP connection that doesn't have IPsec encryption.

### Firewall Rules for VPN Services

Only expose VPN ports — never management ports — to the internet:

\`\`\`
/ip firewall filter
# WireGuard
add chain=input protocol=udp dst-port=13231 action=accept

# IPsec IKE
add chain=input protocol=udp dst-port=500,4500 action=accept

# L2TP
add chain=input protocol=udp dst-port=1701 src-address-list=known-l2tp action=accept

# Block all other input from WAN
add chain=input in-interface=ether1-wan action=drop
\`\`\`

### VPN User Management

Create separate VPN users with minimal permissions:

\`\`\`
/ppp secret
add name=vpnuser1 password=Str0ng!VPN profile=vpn-profile service=any
\`\`\`

Use profiles to restrict what VPN users can access:
\`\`\`
/ppp profile
add name=vpn-profile local-address=10.0.0.1 remote-address=vpn-pool dns-server=8.8.8.8
\`\`\`

### Monitoring VPN Activity

Check active VPN connections:
\`\`\`
/interface wireguard peers print         # WireGuard connected peers
/ip ipsec active-peers print             # IPsec active sessions
/ppp active print                        # PPTP/L2TP active sessions
\`\`\`

Log VPN events:
\`\`\`
/system logging
add topics=pppoe,pptp,l2tp,ipsec action=remote-syslog
\`\`\`

### Summary Checklist

- [ ] WireGuard: non-default port, peers bound to specific IPs
- [ ] IPsec: strong proposals (AES-256, SHA-256, DH group 14+)
- [ ] No PPTP in production
- [ ] L2TP requires IPsec
- [ ] VPN ports firewalled — no other WAN exposure
- [ ] VPN user accounts with strong passwords
- [ ] VPN events logged to syslog`,
    contentFa: `## سخت‌سازی امنیتی VPN در میکروتیک

VPN ها فقط به اندازه‌ای که پیکربندی شده‌اند امن هستند. یک endpoint VPN با پیکربندی ضعیف می‌تواند به‌همان راحتی هر سرویس exposed دیگری اکسپلویت شود. این پست hardening برای رایج‌ترین نوع‌های VPN در میکروتیک را پوشش می‌دهد.

### سخت‌سازی WireGuard

**پورت غیراستاندارد انتخاب کنید:**
\`\`\`
/interface wireguard
add name=wg-vpn listen-port=13231 private-key="<auto-generated>"
\`\`\`

**Peerها را به IPهای خاص محدود کنید:**
\`\`\`
/interface wireguard peers
add interface=wg-vpn public-key="peer-pub-key" allowed-address=10.0.0.2/32
\`\`\`

**قوانین فایروال برای WireGuard:**
\`\`\`
/ip firewall filter
add chain=input protocol=udp dst-port=13231 action=accept comment="WireGuard"
add chain=input in-interface=wg-vpn action=accept
\`\`\`

### سخت‌سازی IPsec IKEv2

**از تنظیمات proposal قوی استفاده کنید:**
\`\`\`
/ip ipsec proposal
set default auth-algorithms=sha256 enc-algorithms=aes-256-cbc pfs-group=modp2048

/ip ipsec profile
set default dh-group=modp2048 enc-algorithm=aes-256 hash-algorithm=sha256
\`\`\`

### نکات امنیتی PPTP/L2TP

**PPTP منسوخ است — از آن اجتناب کنید:**
PPTP از MPPE استفاده می‌کند که ضعف‌های رمزنگاری شناخته‌شده دارد.

**اگر مجبورید L2TP استفاده کنید، همیشه IPsec الزامی کنید:**
\`\`\`
/interface l2tp-server server
set enabled=yes use-ipsec=required ipsec-secret=VeryStr0ngSecret123!
\`\`\`

### قوانین فایروال برای سرویس‌های VPN

\`\`\`
/ip firewall filter
add chain=input protocol=udp dst-port=13231 action=accept
add chain=input protocol=udp dst-port=500,4500 action=accept
add chain=input in-interface=ether1-wan action=drop
\`\`\`

### چک‌لیست

- [ ] WireGuard: پورت غیراستاندارد، peerها محدود به IPهای خاص
- [ ] IPsec: proposal های قوی (AES-256، SHA-256، DH group 14+)
- [ ] بدون PPTP در محیط تولید
- [ ] L2TP نیازمند IPsec
- [ ] پورت‌های VPN فایروال شده
- [ ] حساب‌های کاربری VPN با رمزهای قوی
- [ ] رویدادهای VPN به syslog لاگ می‌شوند`,
  },
  'mikrotik-port-scan-detection-blocking': {
    contentEn: `## Detecting and Blocking Port Scanners on MikroTik

Port scanners probe your router looking for open services. RouterOS has a built-in Port Scan Detection (PSD) module and additional firewall techniques to automatically detect and block scanners.

### Method 1: Built-in PSD Module

RouterOS includes a \`psd\` firewall matcher that detects port scanning behavior:

\`\`\`
/ip firewall filter
add chain=input protocol=tcp psd=21,3s,3,1 action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w comment="Detect TCP port scan"
add chain=input protocol=udp psd=21,3s,3,1 action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w comment="Detect UDP port scan"
add chain=input src-address-list=port-scanners action=drop comment="Drop port scanners"
\`\`\`

PSD parameters: \`21,3s,3,1\` means:
- \`21\`: weight threshold (21 = scanning lots of ports)
- \`3s\`: time period to observe
- \`3\`: low port weight (ports < 1024 count more)
- \`1\`: high port weight (ports ≥ 1024)

### Method 2: Catch Unused Port Access (Honeypot Technique)

Add rules that flag any IP attempting to connect to ports you **never use**:

\`\`\`
/ip firewall filter
# Flag connections to known unused ports as suspicious
add chain=input protocol=tcp dst-port=23 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1w log=yes log-prefix="SCAN-TELNET:"
add chain=input protocol=tcp dst-port=21 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1w log=yes log-prefix="SCAN-FTP:"
add chain=input protocol=tcp dst-port=25 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1w log=yes log-prefix="SCAN-SMTP:"
add chain=input protocol=tcp dst-port=445 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1w log=yes log-prefix="SCAN-SMB:"
\`\`\`

If Telnet (23), FTP (21), SMTP (25), SMB (445) are not running, any connection attempt is a scanner.

### Method 3: Detect Nmap OS Fingerprinting

Nmap uses specific probe packets. Detect invalid TCP flag combinations:

\`\`\`
/ip firewall filter
# Nmap XMAS scan (FIN, URG, PSH all set)
add chain=input protocol=tcp tcp-flags=fin,urg,psh action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w log=yes log-prefix="XMAS-SCAN:"

# Null scan (no flags set)
add chain=input protocol=tcp tcp-flags=!fin,!syn,!rst,!psh,!ack,!urg action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w log=yes log-prefix="NULL-SCAN:"

# FIN scan
add chain=input protocol=tcp tcp-flags=fin action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w log=yes log-prefix="FIN-SCAN:"
\`\`\`

### Method 4: Rate-Limit SYN Packets

Port scanners send SYN packets rapidly. Limit them:

\`\`\`
/ip firewall filter
add chain=input protocol=tcp tcp-flags=syn connection-state=new action=jump jump-target=syn-scan-detect
/ip firewall filter
add chain=syn-scan-detect src-address-list=port-scanners action=drop
add chain=syn-scan-detect action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w limit=100,50:packet
add chain=syn-scan-detect action=accept
\`\`\`

This blacklists any IP that sends more than 100 SYN packets in 50 seconds.

### Viewing Detected Scanners

\`\`\`
/ip firewall address-list print where list=port-scanners
\`\`\`

You'll typically see many entries — especially if your WAN IP is public.

### Checking Logs

\`\`\`
/log print where message~"SCAN"
\`\`\`

### Script: Auto-Alert on New Port Scanners

\`\`\`
/system script
add name=scan-alert source={
    :local count [/ip firewall address-list print count-only where list=port-scanners]
    /log warning message="Port scanner count: $count"
}
/system scheduler add name=scan-alert interval=1h on-event=scan-alert
\`\`\`

### Important Notes

- Place port scanner detection rules **early in the input chain** — before your accept rules — so scanners are blocked before they reach any open service.
- Whitelist your own management IPs to avoid accidentally blocking yourself:

\`\`\`
/ip firewall filter
add chain=input src-address=192.168.88.10 action=accept comment="Management IP - never block" place-before=0
\`\`\`

### Summary

| Technique | Detects |
|-----------|---------|
| PSD module | Rapid multi-port scanning |
| Unused port honeypot | Any probe on closed service ports |
| Invalid TCP flags | Nmap XMAS/NULL/FIN scans |
| SYN rate limiting | High-speed SYN scanners |`,
    contentFa: `## شناسایی و مسدود کردن اسکنرهای پورت در میکروتیک

اسکنرهای پورت روتر شما را برای یافتن سرویس‌های باز بررسی می‌کنند. RouterOS یک ماژول تشخیص اسکن پورت (PSD) داخلی و تکنیک‌های اضافی فایروال دارد.

### روش ۱: ماژول PSD داخلی

\`\`\`
/ip firewall filter
add chain=input protocol=tcp psd=21,3s,3,1 action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w comment="Detect TCP port scan"
add chain=input protocol=udp psd=21,3s,3,1 action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w
add chain=input src-address-list=port-scanners action=drop comment="Drop port scanners"
\`\`\`

### روش ۲: دستگیری دسترسی به پورت‌های استفاده‌نشده

\`\`\`
/ip firewall filter
add chain=input protocol=tcp dst-port=23 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1w log=yes log-prefix="SCAN-TELNET:"
add chain=input protocol=tcp dst-port=21 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1w log=yes log-prefix="SCAN-FTP:"
add chain=input protocol=tcp dst-port=445 action=add-src-to-address-list address-list=port-scanners address-list-timeout=1w log=yes log-prefix="SCAN-SMB:"
\`\`\`

### روش ۳: تشخیص اسکن‌های Nmap

\`\`\`
/ip firewall filter
# XMAS scan
add chain=input protocol=tcp tcp-flags=fin,urg,psh action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w log=yes log-prefix="XMAS-SCAN:"

# Null scan
add chain=input protocol=tcp tcp-flags=!fin,!syn,!rst,!psh,!ack,!urg action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w log=yes log-prefix="NULL-SCAN:"

# FIN scan
add chain=input protocol=tcp tcp-flags=fin action=add-src-to-address-list address-list=port-scanners address-list-timeout=2w log=yes log-prefix="FIN-SCAN:"
\`\`\`

### مشاهده اسکنرهای شناسایی‌شده

\`\`\`
/ip firewall address-list print where list=port-scanners
\`\`\`

### نکات مهم

- قوانین تشخیص اسکنر را **اول در input chain** قرار دهید.
- IP مدیریتی خود را whitelist کنید تا تصادفاً خودتان را مسدود نکنید:

\`\`\`
/ip firewall filter
add chain=input src-address=192.168.88.10 action=accept comment="Management IP - never block" place-before=0
\`\`\`

### خلاصه

| تکنیک | چه چیزی شناسایی می‌کند |
|--------|----------------------|
| ماژول PSD | اسکن سریع چندپورتی |
| Honeypot پورت استفاده‌نشده | هر probe روی پورت‌های سرویس بسته |
| Flag های TCP نامعتبر | اسکن‌های XMAS/NULL/FIN Nmap |
| محدودیت نرخ SYN | اسکنرهای SYN سرعت بالا |`,
  },
}
