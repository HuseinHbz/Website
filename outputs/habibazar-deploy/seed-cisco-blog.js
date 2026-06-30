#!/usr/bin/env node
// Run: node seed-cisco-blog.js /var/www/habibazar/web/data/habibazar.db

const path = require('path')
const dbPath = process.argv[2] || path.join(__dirname, '../web/data/habibazar.db')
const Database = require(path.join(__dirname, '../web/node_modules/better-sqlite3'))
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

// ── Categories ────────────────────────────────────────────────────────────────
const cats = db.prepare(`INSERT OR IGNORE INTO blog_categories (slug, name_en, name_fa, color, sort_order) VALUES (?,?,?,?,?)`)
const catData = [
  ['cisco-basics',    'Cisco Training',           'آموزش سیسکو',              '#2563eb', 1],
  ['cisco-security',  'Network Security',          'امنیت شبکه',              '#dc2626', 2],
  ['cisco-logging',   'Logging & Reporting',       'لاگ‌گیری و گزارش‌گیری',   '#d97706', 3],
  ['cisco-models',    'Cisco Models',              'مدل‌های سیسکو',            '#7c3aed', 4],
  ['cisco-firewall',  'Cisco Firewall',            'فایروال سیسکو',            '#059669', 5],
  ['cisco-config',    'Essential Configurations',  'تنظیمات ضروری',           '#0891b2', 6],
]
catData.forEach(r => cats.run(...r))

function getCatId(slug) {
  return db.prepare('SELECT id FROM blog_categories WHERE slug=?').get(slug)?.id
}

// ── Helper ────────────────────────────────────────────────────────────────────
const ins = db.prepare(`
  INSERT OR IGNORE INTO blog_posts
    (slug, title_en, title_fa, excerpt_en, excerpt_fa, content_en, content_fa,
     category_id, read_time_en, read_time_fa, published_at_en, published_at_fa, status, featured)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`)

function post(slug, titleEn, titleFa, excerptEn, excerptFa, contentEn, contentFa, catSlug, mins, featured=0) {
  ins.run(
    slug, titleEn, titleFa, excerptEn, excerptFa, contentEn, contentFa,
    getCatId(catSlug), `${mins} min read`, `${mins} دقیقه مطالعه`,
    'June 30, 2025', '۹ تیر ۱۴۰۴', 'published', featured
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — آموزش سیسکو صفر تا صد (20 پست)
// ══════════════════════════════════════════════════════════════════════════════

post('cisco-what-is',
  'What is Cisco? Complete Introduction',
  'سیسکو چیست؟ معرفی کامل برای مبتدیان',
  'A beginner-friendly introduction to Cisco Systems and why it dominates networking.',
  'معرفی کامل شرکت سیسکو و اینکه چرا در دنیای شبکه پیشرو است.',
  `## What is Cisco?
Cisco Systems is an American technology company founded in 1984 that designs, manufactures, and sells networking equipment, software, and services. Cisco products power the internet backbone, enterprise networks, and data centers worldwide.

## Why Cisco?
- **Market leader**: Over 60% of enterprise routers and switches are Cisco
- **Industry standard**: Cisco certifications (CCNA, CCNP, CCIE) are globally recognized
- **Reliability**: Used by banks, hospitals, governments, and ISPs
- **Complete ecosystem**: Routers, switches, firewalls, wireless, VoIP — all integrated

## Key Product Lines
| Product | Purpose |
|---------|---------|
| Catalyst Switches | LAN switching |
| ISR Routers | Branch/WAN routing |
| ASA/Firepower | Firewall/Security |
| Meraki | Cloud-managed networking |

## Cisco Certifications Path
CCNA → CCNP → CCIE (each level builds on the previous)`,
  `## سیسکو چیست؟
سیسکو سیستمز یک شرکت فناوری آمریکایی است که در سال ۱۹۸۴ تأسیس شد و تجهیزات شبکه، نرم‌افزار و خدمات طراحی، تولید و فروش می‌کند. محصولات سیسکو زیرساخت اینترنت، شبکه‌های سازمانی و مراکز داده سراسر جهان را تغذیه می‌کنند.

## چرا سیسکو؟
- **رهبر بازار**: بیش از ۶۰٪ روتر و سوئیچ‌های سازمانی از سیسکو هستند
- **استاندارد صنعت**: گواهینامه‌های سیسکو (CCNA، CCNP، CCIE) در سراسر جهان شناخته شده‌اند
- **قابلیت اطمینان**: مورد استفاده بانک‌ها، بیمارستان‌ها، دولت‌ها و ISPها
- **اکوسیستم کامل**: روتر، سوئیچ، فایروال، وایرلس، VoIP — همه یکپارچه

## خطوط محصول اصلی
| محصول | کاربرد |
|-------|---------|
| سوئیچ‌های Catalyst | سوئیچینگ LAN |
| روترهای ISR | مسیریابی شاخه/WAN |
| ASA/Firepower | فایروال/امنیت |
| Meraki | شبکه مدیریت‌شده ابری |

## مسیر گواهینامه‌های سیسکو
CCNA ← CCNP ← CCIE (هر سطح بر پایه سطح قبلی ساخته می‌شود)

## جمع‌بندی
اگر می‌خواهید وارد دنیای شبکه شوید، یادگیری سیسکو بهترین شروع است. اکثر شرکت‌ها از تجهیزات سیسکو استفاده می‌کنند و متخصصان سیسکو همیشه در بازار کار مورد تقاضا هستند.`,
  'cisco-basics', 8, 1)

post('network-basics-for-cisco',
  'Network Fundamentals You Must Know Before Cisco',
  'مفاهیم پایه شبکه که قبل از سیسکو باید بدانید',
  'Learn the essential networking concepts that form the foundation for all Cisco training.',
  'مفاهیم اساسی شبکه که پایه تمام آموزش‌های سیسکو هستند.',
  `## Network Fundamentals

Before touching Cisco gear, you must understand these basics:

## What is a Network?
A network is two or more devices connected together to share resources and communicate.

## Types of Networks
- **LAN (Local Area Network)**: Office, home, school — small geographic area
- **WAN (Wide Area Network)**: Connecting cities/countries — the internet is a WAN
- **MAN (Metropolitan Area Network)**: City-wide network

## Key Networking Devices
| Device | Function |
|--------|----------|
| Switch | Connects devices within a LAN |
| Router | Connects different networks together |
| Firewall | Filters traffic for security |
| Access Point | Provides wireless connectivity |

## Data Transmission
- **Bit**: Smallest unit (0 or 1)
- **Bandwidth**: How much data per second (Mbps, Gbps)
- **Latency**: Delay in milliseconds
- **Packet**: A chunk of data sent over a network

## Ethernet Standards
- Fast Ethernet: 100 Mbps
- Gigabit Ethernet: 1000 Mbps
- 10 Gigabit: 10,000 Mbps`,
  `## مبانی شبکه

قبل از اینکه با تجهیزات سیسکو کار کنید، باید این مفاهیم پایه را بدانید:

## شبکه چیست؟
شبکه یعنی دو یا چند دستگاه که به هم متصل شده‌اند تا منابع را به اشتراک بگذارند و با هم ارتباط برقرار کنند.

## انواع شبکه
- **LAN (شبکه محلی)**: دفتر، خانه، مدرسه — محدوده جغرافیایی کوچک
- **WAN (شبکه گسترده)**: اتصال شهرها/کشورها — اینترنت یک WAN است
- **MAN (شبکه شهری)**: شبکه در سطح شهر

## دستگاه‌های کلیدی شبکه
| دستگاه | عملکرد |
|--------|---------|
| سوئیچ | اتصال دستگاه‌ها در یک LAN |
| روتر | اتصال شبکه‌های مختلف به هم |
| فایروال | فیلتر کردن ترافیک برای امنیت |
| اکسس پوینت | اتصال بی‌سیم |

## انتقال داده
- **بیت**: کوچکترین واحد (۰ یا ۱)
- **پهنای باند**: میزان داده در ثانیه (Mbps، Gbps)
- **تاخیر (Latency)**: تأخیر بر حسب میلی‌ثانیه
- **پکت**: یک تکه داده که از طریق شبکه ارسال می‌شود

## استانداردهای اترنت
- Fast Ethernet: 100 مگابیت
- Gigabit Ethernet: 1000 مگابیت
- 10 Gigabit: 10,000 مگابیت

## کابل‌های شبکه
- **Cat5e**: تا 1 گیگابیت — برای اکثر شبکه‌های خانگی
- **Cat6**: تا 10 گیگابیت — برای دفاتر
- **Cat6A**: تا 10 گیگابیت در فاصله بیشتر
- **فیبر نوری**: برای فاصله‌های طولانی و سرعت بالا`,
  'cisco-basics', 10, 0)

post('osi-model-explained',
  'OSI Model Explained Simply — 7 Layers You Must Know',
  'مدل OSI به زبان ساده — ۷ لایه‌ای که باید بدانید',
  'The OSI model is the foundation of all networking. Learn all 7 layers with real examples.',
  'مدل OSI پایه تمام شبکه‌ها است. همه ۷ لایه را با مثال‌های واقعی یاد بگیرید.',
  `## The OSI Model

OSI (Open Systems Interconnection) is a conceptual framework that describes how data travels from one device to another across a network.

## The 7 Layers (Remember: "Please Do Not Throw Sausage Pizza Away")

| Layer | Name | Function | Example |
|-------|------|----------|---------|
| 7 | Application | User interface | HTTP, FTP, DNS |
| 6 | Presentation | Data format/encryption | SSL/TLS, JPEG |
| 5 | Session | Manages sessions | NetBIOS, RPC |
| 4 | Transport | End-to-end delivery | TCP, UDP |
| 3 | Network | Logical addressing/routing | IP, OSPF |
| 2 | Data Link | Physical addressing | Ethernet, MAC |
| 1 | Physical | Bits on wire | Cables, signals |

## How Data Travels (Encapsulation)
When you send an email:
1. Layer 7 creates the data
2. Layer 4 adds a header (TCP port numbers)
3. Layer 3 adds IP addresses
4. Layer 2 adds MAC addresses
5. Layer 1 sends as electrical signals

## Why Does This Matter for Cisco?
Cisco devices operate at specific layers:
- **Switches** = Layer 2 (MAC addresses)
- **Routers** = Layer 3 (IP addresses)
- **Firewalls** = Layer 4-7 (ports, applications)`,
  `## مدل OSI چیست؟

OSI (اتصال سیستم‌های باز) یک چارچوب مفهومی است که توضیح می‌دهد چگونه داده از یک دستگاه به دستگاه دیگر از طریق شبکه منتقل می‌شود.

## ۷ لایه مدل OSI

| لایه | نام | عملکرد | مثال |
|------|-----|---------|------|
| ۷ | کاربردی (Application) | رابط کاربری | HTTP، FTP، DNS |
| ۶ | ارائه (Presentation) | فرمت داده / رمزنگاری | SSL/TLS، JPEG |
| ۵ | جلسه (Session) | مدیریت جلسات | NetBIOS، RPC |
| ۴ | انتقال (Transport) | تحویل سرتاسری | TCP، UDP |
| ۳ | شبکه (Network) | آدرس‌دهی منطقی / مسیریابی | IP، OSPF |
| ۲ | پیوند داده (Data Link) | آدرس‌دهی فیزیکی | Ethernet، MAC |
| ۱ | فیزیکی (Physical) | بیت روی کابل | کابل‌ها، سیگنال‌ها |

## چگونه داده منتقل می‌شود؟ (Encapsulation)
وقتی یک ایمیل ارسال می‌کنید:
1. لایه ۷ داده را ایجاد می‌کند
2. لایه ۴ هدر اضافه می‌کند (شماره پورت TCP)
3. لایه ۳ آدرس‌های IP اضافه می‌کند
4. لایه ۲ آدرس‌های MAC اضافه می‌کند
5. لایه ۱ به صورت سیگنال الکتریکی ارسال می‌شود

## چرا برای سیسکو مهم است؟
دستگاه‌های سیسکو در لایه‌های خاصی کار می‌کنند:
- **سوئیچ‌ها** = لایه ۲ (آدرس MAC)
- **روترها** = لایه ۳ (آدرس IP)
- **فایروال‌ها** = لایه ۴ تا ۷ (پورت‌ها، اپلیکیشن‌ها)

## تفاوت OSI با TCP/IP
مدل TCP/IP که در عمل استفاده می‌شود ۴ لایه دارد:
- Application (لایه ۷+۶+۵ OSI)
- Transport (لایه ۴ OSI)
- Internet (لایه ۳ OSI)
- Network Access (لایه ۲+۱ OSI)`,
  'cisco-basics', 12, 0)

post('tcp-ip-protocol-suite',
  'TCP/IP Protocol Suite — The Language of the Internet',
  'پروتکل TCP/IP — زبان اینترنت',
  'Understand TCP/IP, the protocol suite that runs the entire internet.',
  'TCP/IP را درک کنید؛ مجموعه پروتکل‌هایی که کل اینترنت را اجرا می‌کنند.',
  `## TCP/IP Protocol Suite

TCP/IP is the set of communication protocols that the internet runs on. It defines how data is formatted, addressed, transmitted, and received.

## TCP vs UDP

| Feature | TCP | UDP |
|---------|-----|-----|
| Connection | Connection-oriented | Connectionless |
| Reliability | Guaranteed delivery | No guarantee |
| Speed | Slower | Faster |
| Use cases | Web, Email, FTP | DNS, VoIP, Gaming |

## The TCP Three-Way Handshake
Before data transfer, TCP establishes a connection:
1. **SYN**: "Hello, can we talk?"
2. **SYN-ACK**: "Yes, I'm ready!"
3. **ACK**: "Great, let's start!"

## Common TCP Ports
| Port | Protocol |
|------|----------|
| 80 | HTTP |
| 443 | HTTPS |
| 22 | SSH |
| 23 | Telnet |
| 25 | SMTP |
| 53 | DNS |
| 21 | FTP |

## IP Addressing
Every device needs an IP address — like a postal address for your computer.
- IPv4: 192.168.1.1 (32-bit, ~4 billion addresses)
- IPv6: 2001:db8::1 (128-bit, virtually unlimited)`,
  `## مجموعه پروتکل TCP/IP

TCP/IP مجموعه‌ای از پروتکل‌های ارتباطی است که اینترنت روی آن اجرا می‌شود. این پروتکل تعریف می‌کند که چگونه داده فرمت‌بندی، آدرس‌دهی، انتقال و دریافت می‌شود.

## TCP در مقابل UDP

| ویژگی | TCP | UDP |
|-------|-----|-----|
| اتصال | اتصال‌گرا | بدون اتصال |
| قابلیت اطمینان | تحویل تضمین‌شده | بدون تضمین |
| سرعت | کندتر | سریع‌تر |
| کاربردها | وب، ایمیل، FTP | DNS، VoIP، بازی |

## دست‌دهی سه‌طرفه TCP
قبل از انتقال داده، TCP یک اتصال برقرار می‌کند:
1. **SYN**: «سلام، می‌توانیم صحبت کنیم؟»
2. **SYN-ACK**: «بله، آماده‌ام!»
3. **ACK**: «عالی، شروع کنیم!»

## پورت‌های رایج TCP
| پورت | پروتکل | کاربرد |
|------|---------|---------|
| ۸۰ | HTTP | وب‌سایت‌های معمولی |
| ۴۴۳ | HTTPS | وب‌سایت‌های امن |
| ۲۲ | SSH | اتصال امن به سرور |
| ۲۳ | Telnet | اتصال قدیمی (ناامن) |
| ۲۵ | SMTP | ارسال ایمیل |
| ۵۳ | DNS | تبدیل نام به IP |
| ۲۱ | FTP | انتقال فایل |

## آدرس‌دهی IP
هر دستگاه به یک آدرس IP نیاز دارد — مثل آدرس پستی کامپیوتر شما:
- IPv4: 192.168.1.1 (32 بیتی، حدود ۴ میلیارد آدرس)
- IPv6: 2001:db8::1 (128 بیتی، عملاً نامحدود)

## چرا TCP/IP مهم است؟
وقتی در سیسکو ACL، NAT یا Routing تنظیم می‌کنید، همه آنها بر پایه TCP/IP کار می‌کنند. درک این پروتکل‌ها برای هر متخصص شبکه ضروری است.`,
  'cisco-basics', 10, 0)

post('ip-addressing-subnetting',
  'IP Addressing and Subnetting — Complete Guide',
  'آدرس‌دهی IP و زیرشبکه‌بندی — راهنمای کامل',
  'Master IP addressing and subnetting — the most critical skills for any network engineer.',
  'آدرس‌دهی IP و زیرشبکه‌بندی را به طور کامل یاد بگیرید — مهم‌ترین مهارت مهندس شبکه.',
  `## IP Addressing

An IP address is a unique identifier for a device on a network.

## IPv4 Address Classes
| Class | Range | Default Subnet | Use |
|-------|-------|---------------|-----|
| A | 1-126 | /8 (255.0.0.0) | Large networks |
| B | 128-191 | /16 (255.255.0.0) | Medium networks |
| C | 192-223 | /24 (255.255.255.0) | Small networks |

## Private IP Ranges (RFC 1918)
These are NOT routable on the internet:
- 10.0.0.0 – 10.255.255.255
- 172.16.0.0 – 172.31.255.255
- 192.168.0.0 – 192.168.255.255

## Subnetting
Subnetting divides a large network into smaller networks.

### Why Subnet?
- Better security (isolate departments)
- Reduce broadcast traffic
- Efficient IP usage

### CIDR Notation
- /24 = 255.255.255.0 = 256 addresses (254 usable)
- /25 = 255.255.255.128 = 128 addresses (126 usable)
- /26 = 255.255.255.192 = 64 addresses (62 usable)

### Example: Subnet 192.168.1.0/24 into 4 subnets
- Subnet 1: 192.168.1.0/26 (hosts .1-.62, broadcast .63)
- Subnet 2: 192.168.1.64/26 (hosts .65-.126, broadcast .127)
- Subnet 3: 192.168.1.128/26 (hosts .129-.190, broadcast .191)
- Subnet 4: 192.168.1.192/26 (hosts .193-.254, broadcast .255)`,
  `## آدرس‌دهی IP

آدرس IP یک شناسه منحصر به فرد برای یک دستگاه در شبکه است.

## کلاس‌های آدرس IPv4
| کلاس | محدوده | زیرشبکه پیش‌فرض | کاربرد |
|------|--------|-----------------|--------|
| A | 1-126 | /8 (255.0.0.0) | شبکه‌های بزرگ |
| B | 128-191 | /16 (255.255.0.0) | شبکه‌های متوسط |
| C | 192-223 | /24 (255.255.255.0) | شبکه‌های کوچک |

## محدوده‌های IP خصوصی (RFC 1918)
این آدرس‌ها در اینترنت مسیریابی نمی‌شوند:
- 10.0.0.0 تا 10.255.255.255
- 172.16.0.0 تا 172.31.255.255
- 192.168.0.0 تا 192.168.255.255

## زیرشبکه‌بندی (Subnetting)
زیرشبکه‌بندی یک شبکه بزرگ را به شبکه‌های کوچک‌تر تقسیم می‌کند.

### چرا زیرشبکه‌بندی؟
- امنیت بهتر (جداسازی بخش‌ها)
- کاهش ترافیک Broadcast
- استفاده بهینه از IP

### نمادگذاری CIDR
- /24 = 255.255.255.0 = ۲۵۶ آدرس (۲۵۴ قابل استفاده)
- /25 = 255.255.255.128 = ۱۲۸ آدرس (۱۲۶ قابل استفاده)
- /26 = 255.255.255.192 = ۶۴ آدرس (۶۲ قابل استفاده)
- /27 = 255.255.255.224 = ۳۲ آدرس (۳۰ قابل استفاده)
- /28 = 255.255.255.240 = ۱۶ آدرس (۱۴ قابل استفاده)
- /30 = 255.255.255.252 = ۴ آدرس (۲ قابل استفاده — برای لینک‌های WAN)

### مثال عملی: تقسیم 192.168.1.0/24 به ۴ زیرشبکه
- زیرشبکه ۱: 192.168.1.0/26 (هاست‌ها .1 تا .62، Broadcast: .63)
- زیرشبکه ۲: 192.168.1.64/26 (هاست‌ها .65 تا .126، Broadcast: .127)
- زیرشبکه ۳: 192.168.1.128/26 (هاست‌ها .129 تا .190، Broadcast: .191)
- زیرشبکه ۴: 192.168.1.192/26 (هاست‌ها .193 تا .254، Broadcast: .255)

### قانون ساده محاسبه
برای n بیت قرض گرفته شده:
- تعداد زیرشبکه = 2^n
- تعداد هاست = 2^(32-prefix) - 2`,
  'cisco-basics', 15, 0)

post('cisco-switch-intro',
  'Cisco Switch — Introduction and Initial Setup',
  'سوئیچ سیسکو — معرفی و راه‌اندازی اولیه',
  'Learn what a Cisco switch does and how to configure it from scratch.',
  'بیاموزید سوئیچ سیسکو چه کاری می‌کند و چطور از صفر آن را پیکربندی کنید.',
  `## What is a Cisco Switch?
A switch is a Layer 2 device that connects multiple devices within the same network (LAN). Unlike a hub, a switch sends data only to the destination device, not to everyone.

## How Does a Switch Work?
1. Device A sends a frame to Device B
2. Switch reads the destination MAC address
3. Switch looks up its MAC Address Table
4. Switch forwards the frame ONLY to Device B's port

## MAC Address Table
The switch builds this table automatically:
- Port 1: AA:BB:CC:DD:EE:01 (PC1)
- Port 2: AA:BB:CC:DD:EE:02 (PC2)

## Initial Switch Configuration

### Connect via Console Cable
Use a console cable (RJ-45 to DB-9 or USB) and terminal software (PuTTY).

### Basic Setup Commands
\`\`\`
Switch> enable
Switch# configure terminal
Switch(config)# hostname SW1
SW1(config)# enable secret MyPassword123
SW1(config)# service password-encryption
SW1(config)# banner motd # Authorized Access Only #
SW1(config)# line console 0
SW1(config-line)# password ConsolePass
SW1(config-line)# login
SW1(config-line)# exit
SW1(config)# line vty 0 15
SW1(config-line)# password VtyPass
SW1(config-line)# login
SW1(config-line)# transport input ssh
SW1(config)# end
SW1# write memory
\`\`\`

### Configure Management IP
\`\`\`
SW1(config)# interface vlan 1
SW1(config-if)# ip address 192.168.1.10 255.255.255.0
SW1(config-if)# no shutdown
SW1(config)# ip default-gateway 192.168.1.1
\`\`\``,
  `## سوئیچ سیسکو چیست؟
سوئیچ یک دستگاه لایه ۲ است که چندین دستگاه را در یک شبکه (LAN) به هم متصل می‌کند. برخلاف هاب، سوئیچ داده را فقط به دستگاه مقصد می‌فرستد، نه به همه.

## سوئیچ چگونه کار می‌کند؟
1. دستگاه A یک فریم به دستگاه B می‌فرستد
2. سوئیچ آدرس MAC مقصد را می‌خواند
3. سوئیچ در جدول آدرس MAC خود جستجو می‌کند
4. سوئیچ فریم را فقط به پورت دستگاه B ارسال می‌کند

## جدول آدرس MAC
سوئیچ این جدول را به صورت خودکار می‌سازد:
- پورت ۱: AA:BB:CC:DD:EE:01 (PC1)
- پورت ۲: AA:BB:CC:DD:EE:02 (PC2)

## پیکربندی اولیه سوئیچ

### اتصال از طریق کابل کنسول
از کابل کنسول (RJ-45 به DB-9 یا USB) و نرم‌افزار ترمینال (PuTTY) استفاده کنید.

### دستورات راه‌اندازی پایه
\`\`\`
Switch> enable
Switch# configure terminal
Switch(config)# hostname SW1
SW1(config)# enable secret MyPassword123
SW1(config)# service password-encryption
SW1(config)# banner motd # فقط دسترسی مجاز #
SW1(config)# line console 0
SW1(config-line)# password ConsolePass
SW1(config-line)# login
SW1(config-line)# exit
SW1(config)# line vty 0 15
SW1(config-line)# password VtyPass
SW1(config-line)# login
SW1(config-line)# transport input ssh
SW1(config)# end
SW1# write memory
\`\`\`

### پیکربندی IP مدیریت
\`\`\`
SW1(config)# interface vlan 1
SW1(config-if)# ip address 192.168.1.10 255.255.255.0
SW1(config-if)# no shutdown
SW1(config)# ip default-gateway 192.168.1.1
\`\`\`

## دستورات مفید بررسی
\`\`\`
SW1# show mac address-table          ! نمایش جدول MAC
SW1# show interfaces status          ! وضعیت پورت‌ها
SW1# show version                    ! اطلاعات سخت‌افزار
SW1# show running-config             ! پیکربندی فعلی
\`\`\``,
  'cisco-basics', 12, 0)

post('vlan-configuration',
  'VLAN — What It Is and How to Configure It on Cisco',
  'VLAN چیست و چگونه در سیسکو تنظیم کنیم؟',
  'VLANs let you segment your network logically. Learn to create and configure VLANs step by step.',
  'VLAN به شما امکان می‌دهد شبکه را به صورت منطقی تقسیم کنید. گام به گام یاد بگیرید.',
  `## What is a VLAN?
VLAN (Virtual Local Area Network) allows you to logically divide a physical switch into multiple separate networks. Devices in different VLANs cannot communicate without a router, even if they're connected to the same switch.

## Why Use VLANs?
- **Security**: Separate HR from Engineering
- **Performance**: Reduce broadcast domains
- **Flexibility**: Group users by function, not location

## VLAN Configuration

### Create VLANs
\`\`\`
SW1(config)# vlan 10
SW1(config-vlan)# name Sales
SW1(config-vlan)# exit
SW1(config)# vlan 20
SW1(config-vlan)# name Engineering
SW1(config-vlan)# exit
SW1(config)# vlan 30
SW1(config-vlan)# name Management
\`\`\`

### Assign Ports to VLANs (Access Mode)
\`\`\`
SW1(config)# interface range fa0/1-10
SW1(config-if-range)# switchport mode access
SW1(config-if-range)# switchport access vlan 10

SW1(config)# interface range fa0/11-20
SW1(config-if-range)# switchport mode access
SW1(config-if-range)# switchport access vlan 20
\`\`\`

### Configure Trunk Port (carries multiple VLANs)
\`\`\`
SW1(config)# interface gi0/1
SW1(config-if)# switchport mode trunk
SW1(config-if)# switchport trunk allowed vlan 10,20,30
\`\`\`

### Verify
\`\`\`
SW1# show vlan brief
SW1# show interfaces trunk
\`\`\``,
  `## VLAN چیست؟
VLAN (شبکه محلی مجازی) به شما اجازه می‌دهد یک سوئیچ فیزیکی را به صورت منطقی به چندین شبکه جداگانه تقسیم کنید. دستگاه‌ها در VLANهای مختلف بدون روتر نمی‌توانند با هم ارتباط برقرار کنند، حتی اگر به یک سوئیچ متصل باشند.

## چرا از VLAN استفاده کنیم؟
- **امنیت**: جداسازی HR از مهندسی
- **عملکرد**: کاهش دامنه Broadcast
- **انعطاف‌پذیری**: گروه‌بندی کاربران بر اساس عملکرد، نه موقعیت

## پیکربندی VLAN

### ایجاد VLAN
\`\`\`
SW1(config)# vlan 10
SW1(config-vlan)# name Sales
SW1(config-vlan)# exit
SW1(config)# vlan 20
SW1(config-vlan)# name Engineering
SW1(config-vlan)# exit
SW1(config)# vlan 30
SW1(config-vlan)# name Management
\`\`\`

### اختصاص پورت به VLAN (حالت Access)
\`\`\`
SW1(config)# interface range fa0/1-10
SW1(config-if-range)# switchport mode access
SW1(config-if-range)# switchport access vlan 10

SW1(config)# interface range fa0/11-20
SW1(config-if-range)# switchport mode access
SW1(config-if-range)# switchport access vlan 20
\`\`\`

### پیکربندی پورت Trunk (حامل چندین VLAN)
\`\`\`
SW1(config)# interface gi0/1
SW1(config-if)# switchport mode trunk
SW1(config-if)# switchport trunk allowed vlan 10,20,30
SW1(config-if)# switchport trunk native vlan 99
\`\`\`

### بررسی پیکربندی
\`\`\`
SW1# show vlan brief
SW1# show interfaces trunk
SW1# show interfaces fa0/1 switchport
\`\`\`

## Inter-VLAN Routing (ارتباط بین VLANها)
برای ارتباط بین VLANها به روتر یا سوئیچ لایه ۳ نیاز دارید:
\`\`\`
Router(config)# interface gi0/0.10
Router(config-subif)# encapsulation dot1q 10
Router(config-subif)# ip address 192.168.10.1 255.255.255.0

Router(config)# interface gi0/0.20
Router(config-subif)# encapsulation dot1q 20
Router(config-subif)# ip address 192.168.20.1 255.255.255.0
\`\`\``,
  'cisco-basics', 14, 0)

post('cisco-router-intro',
  'Cisco Router — Introduction and Basic Configuration',
  'روتر سیسکو — معرفی و پیکربندی پایه',
  'Learn what a Cisco router does and how to set it up for the first time.',
  'بیاموزید روتر سیسکو چه می‌کند و چطور برای اولین بار آن را راه‌اندازی کنید.',
  `## What is a Router?
A router is a Layer 3 device that connects different networks together and routes traffic between them using IP addresses.

## Router vs Switch
| Feature | Switch | Router |
|---------|--------|--------|
| Layer | Layer 2 | Layer 3 |
| Addresses | MAC addresses | IP addresses |
| Function | LAN connectivity | Inter-network routing |
| Broadcast | Forwards broadcasts | Blocks broadcasts |

## Basic Router Configuration
\`\`\`
Router> enable
Router# configure terminal
Router(config)# hostname R1
R1(config)# enable secret StrongPass123
R1(config)# no ip domain-lookup

! Configure WAN interface
R1(config)# interface gi0/0
R1(config-if)# description WAN-to-ISP
R1(config-if)# ip address 203.0.113.2 255.255.255.252
R1(config-if)# no shutdown

! Configure LAN interface
R1(config)# interface gi0/1
R1(config-if)# description LAN
R1(config-if)# ip address 192.168.1.1 255.255.255.0
R1(config-if)# no shutdown

R1# show ip interface brief
R1# show ip route
\`\`\`

## Default Route (Internet gateway)
\`\`\`
R1(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1
\`\`\``,
  `## روتر چیست؟
روتر یک دستگاه لایه ۳ است که شبکه‌های مختلف را به هم متصل می‌کند و ترافیک را با استفاده از آدرس‌های IP بین آنها مسیریابی می‌کند.

## روتر در مقابل سوئیچ
| ویژگی | سوئیچ | روتر |
|-------|-------|------|
| لایه | لایه ۲ | لایه ۳ |
| آدرس‌ها | آدرس MAC | آدرس IP |
| عملکرد | اتصال LAN | مسیریابی بین شبکه‌ها |
| Broadcast | ارسال می‌کند | مسدود می‌کند |

## پیکربندی پایه روتر
\`\`\`
Router> enable
Router# configure terminal
Router(config)# hostname R1
R1(config)# enable secret StrongPass123
R1(config)# no ip domain-lookup

! پیکربندی اینترفیس WAN
R1(config)# interface gi0/0
R1(config-if)# description WAN-to-ISP
R1(config-if)# ip address 203.0.113.2 255.255.255.252
R1(config-if)# no shutdown

! پیکربندی اینترفیس LAN
R1(config)# interface gi0/1
R1(config-if)# description LAN-Network
R1(config-if)# ip address 192.168.1.1 255.255.255.0
R1(config-if)# no shutdown

R1# write memory
\`\`\`

## مسیر پیش‌فرض (دروازه اینترنت)
\`\`\`
R1(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1
\`\`\`

## دستورات بررسی مهم
\`\`\`
R1# show ip interface brief        ! وضعیت اینترفیس‌ها
R1# show ip route                  ! جدول مسیریابی
R1# show running-config            ! پیکربندی فعلی
R1# ping 8.8.8.8                   ! تست اتصال
R1# traceroute 8.8.8.8             ! ردیابی مسیر
\`\`\`

## ذخیره پیکربندی
\`\`\`
R1# write memory
! یا
R1# copy running-config startup-config
\`\`\``,
  'cisco-basics', 12, 0)

post('static-routing',
  'Static Routing in Cisco — Configuration and Examples',
  'مسیریابی استاتیک در سیسکو — پیکربندی و مثال‌های عملی',
  'Learn how to manually configure routing tables with static routes on Cisco routers.',
  'یاد بگیرید چطور جداول مسیریابی را با مسیرهای استاتیک به صورت دستی پیکربندی کنید.',
  `## What is Static Routing?
Static routing is when a network administrator manually configures routes in the routing table. Unlike dynamic routing, routes don't change automatically.

## When to Use Static Routing?
- Small networks with few paths
- Stub networks (single connection point)
- Default routes to ISP
- Backup routes

## Static Route Syntax
\`\`\`
ip route [destination-network] [subnet-mask] [next-hop-ip OR exit-interface]
\`\`\`

## Example Topology
- R1 LAN: 192.168.1.0/24 (gi0/1)
- R1 WAN: 10.0.0.1 (gi0/0)
- R2 WAN: 10.0.0.2 (gi0/0)
- R2 LAN: 192.168.2.0/24 (gi0/1)

### Configure R1
\`\`\`
R1(config)# ip route 192.168.2.0 255.255.255.0 10.0.0.2
\`\`\`

### Configure R2
\`\`\`
R2(config)# ip route 192.168.1.0 255.255.255.0 10.0.0.1
\`\`\`

### Default Route (0.0.0.0/0)
\`\`\`
R1(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1
\`\`\`

### Verify
\`\`\`
R1# show ip route static
R1# ping 192.168.2.1 source 192.168.1.1
\`\`\``,
  `## مسیریابی استاتیک چیست؟
مسیریابی استاتیک یعنی مدیر شبکه به صورت دستی مسیرها را در جدول مسیریابی تنظیم می‌کند. برخلاف مسیریابی پویا، مسیرها به صورت خودکار تغییر نمی‌کنند.

## چه زمانی از مسیریابی استاتیک استفاده کنیم؟
- شبکه‌های کوچک با مسیرهای کم
- شبکه‌های Stub (یک نقطه اتصال)
- مسیر پیش‌فرض به ISP
- مسیرهای پشتیبان

## نحو دستور مسیر استاتیک
\`\`\`
ip route [شبکه-مقصد] [ماسک-زیرشبکه] [IP-هاپ-بعدی یا اینترفیس-خروجی]
\`\`\`

## توپولوژی مثال
- LAN روتر R1: 192.168.1.0/24 (gi0/1)
- WAN روتر R1: 10.0.0.1 (gi0/0)
- WAN روتر R2: 10.0.0.2 (gi0/0)
- LAN روتر R2: 192.168.2.0/24 (gi0/1)

### پیکربندی R1
\`\`\`
R1(config)# ip route 192.168.2.0 255.255.255.0 10.0.0.2
\`\`\`

### پیکربندی R2
\`\`\`
R2(config)# ip route 192.168.1.0 255.255.255.0 10.0.0.1
\`\`\`

### مسیر پیش‌فرض (0.0.0.0/0)
\`\`\`
R1(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1
\`\`\`

### بررسی
\`\`\`
R1# show ip route static          ! مسیرهای استاتیک
R1# show ip route                 ! جدول کامل مسیریابی
R1# ping 192.168.2.1 source 192.168.1.1
\`\`\`

## مسیر استاتیک شناور (Floating Static Route)
برای مسیر پشتیبان با Administrative Distance بالاتر:
\`\`\`
R1(config)# ip route 192.168.2.0 255.255.255.0 10.0.0.2 1    ! مسیر اصلی
R1(config)# ip route 192.168.2.0 255.255.255.0 10.0.1.2 150  ! مسیر پشتیبان
\`\`\``,
  'cisco-basics', 13, 0)

post('ospf-routing-protocol',
  'OSPF Routing Protocol — Complete Configuration Guide',
  'پروتکل مسیریابی OSPF — راهنمای کامل پیکربندی',
  'OSPF is the most common dynamic routing protocol. Learn to configure it step by step.',
  'OSPF رایج‌ترین پروتکل مسیریابی پویا است. گام به گام پیکربندی آن را یاد بگیرید.',
  `## What is OSPF?
OSPF (Open Shortest Path First) is a link-state routing protocol that automatically discovers and maintains routes. It uses the Dijkstra algorithm to find the shortest path.

## OSPF Key Concepts
- **Link-State**: Each router knows the complete network topology
- **Area**: Logical grouping of routers (Area 0 = backbone)
- **DR/BDR**: Designated Router / Backup DR for multi-access networks
- **Cost**: Metric based on bandwidth (100Mbps/interface bandwidth)

## Basic OSPF Configuration (Single Area)
\`\`\`
R1(config)# router ospf 1
R1(config-router)# router-id 1.1.1.1
R1(config-router)# network 192.168.1.0 0.0.0.255 area 0
R1(config-router)# network 10.0.0.0 0.0.0.3 area 0
R1(config-router)# passive-interface gi0/1  ! Don't send OSPF on LAN
\`\`\`

\`\`\`
R2(config)# router ospf 1
R2(config-router)# router-id 2.2.2.2
R2(config-router)# network 192.168.2.0 0.0.0.255 area 0
R2(config-router)# network 10.0.0.0 0.0.0.3 area 0
\`\`\`

## Verify OSPF
\`\`\`
R1# show ip ospf neighbor         ! Check adjacency
R1# show ip ospf database         ! LSDB
R1# show ip route ospf            ! OSPF routes
\`\`\``,
  `## OSPF چیست؟
OSPF (اول کوتاه‌ترین مسیر باز) یک پروتکل مسیریابی Link-State است که به صورت خودکار مسیرها را کشف و نگهداری می‌کند. از الگوریتم Dijkstra برای یافتن کوتاه‌ترین مسیر استفاده می‌کند.

## مفاهیم کلیدی OSPF
- **Link-State**: هر روتر توپولوژی کامل شبکه را می‌داند
- **Area**: گروه‌بندی منطقی روترها (Area 0 = ستون فقرات)
- **DR/BDR**: روتر تعیین‌شده / روتر تعیین‌شده پشتیبان
- **Cost**: معیار بر اساس پهنای باند (100Mbps/پهنای‌باند اینترفیس)

## پیکربندی پایه OSPF (یک Area)
\`\`\`
R1(config)# router ospf 1
R1(config-router)# router-id 1.1.1.1
R1(config-router)# network 192.168.1.0 0.0.0.255 area 0
R1(config-router)# network 10.0.0.0 0.0.0.3 area 0
R1(config-router)# passive-interface gi0/1  ! ارسال OSPF به LAN متوقف شود
\`\`\`

\`\`\`
R2(config)# router ospf 1
R2(config-router)# router-id 2.2.2.2
R2(config-router)# network 192.168.2.0 0.0.0.255 area 0
R2(config-router)# network 10.0.0.0 0.0.0.3 area 0
\`\`\`

## بررسی OSPF
\`\`\`
R1# show ip ospf neighbor         ! بررسی مجاورت
R1# show ip ospf database         ! پایگاه داده LSDB
R1# show ip route ospf            ! مسیرهای OSPF
R1# show ip ospf interface        ! اطلاعات اینترفیس OSPF
\`\`\`

## تنظیم OSPF Hello/Dead Timers
\`\`\`
R1(config)# interface gi0/0
R1(config-if)# ip ospf hello-interval 10
R1(config-if)# ip ospf dead-interval 40
\`\`\`

## توزیع مسیر پیش‌فرض در OSPF
\`\`\`
R1(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1
R1(config)# router ospf 1
R1(config-router)# default-information originate always
\`\`\``,
  'cisco-basics', 14, 0)

post('nat-pat-cisco',
  'NAT and PAT in Cisco — Complete Configuration',
  'NAT و PAT در سیسکو — پیکربندی کامل',
  'NAT allows private IPs to access the internet. Learn all types of NAT in Cisco.',
  'NAT به IP‌های خصوصی اجازه دسترسی به اینترنت می‌دهد. انواع NAT را در سیسکو یاد بگیرید.',
  `## What is NAT?
NAT (Network Address Translation) translates private IP addresses to public IP addresses, allowing internal devices to access the internet with limited public IPs.

## Types of NAT
1. **Static NAT**: One private IP ↔ One public IP (for servers)
2. **Dynamic NAT**: Pool of public IPs (many-to-many)
3. **PAT/NAT Overload**: Many private IPs → One public IP (most common)

## PAT Configuration (Most Common)
\`\`\`
! Define inside and outside interfaces
R1(config)# interface gi0/0
R1(config-if)# ip nat outside

R1(config)# interface gi0/1
R1(config-if)# ip nat inside

! Create access list for inside hosts
R1(config)# access-list 1 permit 192.168.1.0 0.0.0.255

! Enable PAT
R1(config)# ip nat inside source list 1 interface gi0/0 overload
\`\`\`

## Static NAT (for servers)
\`\`\`
R1(config)# ip nat inside source static 192.168.1.100 203.0.113.10
\`\`\`

## Verify NAT
\`\`\`
R1# show ip nat translations
R1# show ip nat statistics
R1# debug ip nat
\`\`\``,
  `## NAT چیست؟
NAT (ترجمه آدرس شبکه) آدرس‌های IP خصوصی را به آدرس‌های IP عمومی ترجمه می‌کند و به دستگاه‌های داخلی اجازه می‌دهد با تعداد محدودی IP عمومی به اینترنت دسترسی داشته باشند.

## انواع NAT
1. **NAT استاتیک**: یک IP خصوصی ↔ یک IP عمومی (برای سرورها)
2. **NAT پویا**: استخر IP‌های عمومی (چند به چند)
3. **PAT / NAT Overload**: بسیاری IP خصوصی → یک IP عمومی (رایج‌ترین)

## پیکربندی PAT (رایج‌ترین)
\`\`\`
! تعریف اینترفیس‌های داخل و خارج
R1(config)# interface gi0/0
R1(config-if)# ip nat outside

R1(config)# interface gi0/1
R1(config-if)# ip nat inside

! ایجاد لیست دسترسی برای هاست‌های داخلی
R1(config)# access-list 1 permit 192.168.1.0 0.0.0.255

! فعال‌سازی PAT
R1(config)# ip nat inside source list 1 interface gi0/0 overload
\`\`\`

## NAT استاتیک (برای سرورها)
\`\`\`
R1(config)# ip nat inside source static 192.168.1.100 203.0.113.10
\`\`\`

## بررسی NAT
\`\`\`
R1# show ip nat translations        ! ترجمه‌های فعال
R1# show ip nat statistics          ! آمار NAT
R1# clear ip nat translation *      ! پاک کردن جدول NAT
\`\`\`

## چرا PAT مهم‌تر از NAT است؟
PAT (که به آن NAT Overload هم می‌گویند) از شماره پورت‌های TCP/UDP برای تفکیک اتصالات استفاده می‌کند، بنابراین هزاران دستگاه داخلی می‌توانند از یک IP عمومی به اینترنت متصل شوند.`,
  'cisco-basics', 13, 0)

post('dhcp-cisco',
  'DHCP on Cisco Router — Setup and Configuration',
  'DHCP در روتر سیسکو — راه‌اندازی و پیکربندی',
  'Configure Cisco as a DHCP server to automatically assign IP addresses to network devices.',
  'سیسکو را به عنوان سرور DHCP پیکربندی کنید تا به طور خودکار IP به دستگاه‌ها اختصاص دهد.',
  `## What is DHCP?
DHCP (Dynamic Host Configuration Protocol) automatically assigns IP addresses, subnet masks, default gateways, and DNS servers to network devices — eliminating manual configuration.

## Cisco Router as DHCP Server
\`\`\`
R1(config)# ip dhcp excluded-address 192.168.1.1 192.168.1.20

R1(config)# ip dhcp pool OFFICE-LAN
R1(dhcp-config)# network 192.168.1.0 255.255.255.0
R1(dhcp-config)# default-router 192.168.1.1
R1(dhcp-config)# dns-server 8.8.8.8 8.8.4.4
R1(dhcp-config)# domain-name company.local
R1(dhcp-config)# lease 7
\`\`\`

## DHCP Helper Address (Relay)
When DHCP server is on a different subnet:
\`\`\`
R1(config)# interface gi0/1
R1(config-if)# ip helper-address 192.168.100.10
\`\`\`

## Verify DHCP
\`\`\`
R1# show ip dhcp pool
R1# show ip dhcp binding
R1# show ip dhcp statistics
\`\`\`

## Static DHCP Binding (Reserve IP for device)
\`\`\`
R1(config)# ip dhcp pool PRINTER
R1(dhcp-config)# host 192.168.1.50 255.255.255.0
R1(dhcp-config)# hardware-address 00AA.BBCC.DDEE
\`\`\``,
  `## DHCP چیست؟
DHCP (پروتکل پیکربندی پویا میزبان) به صورت خودکار آدرس‌های IP، ماسک زیرشبکه، دروازه پیش‌فرض و سرورهای DNS را به دستگاه‌های شبکه اختصاص می‌دهد و پیکربندی دستی را حذف می‌کند.

## روتر سیسکو به عنوان سرور DHCP
\`\`\`
! آدرس‌هایی که نباید اختصاص داده شوند (رزرو برای دستگاه‌های ثابت)
R1(config)# ip dhcp excluded-address 192.168.1.1 192.168.1.20

! ایجاد Pool DHCP
R1(config)# ip dhcp pool OFFICE-LAN
R1(dhcp-config)# network 192.168.1.0 255.255.255.0
R1(dhcp-config)# default-router 192.168.1.1
R1(dhcp-config)# dns-server 8.8.8.8 8.8.4.4
R1(dhcp-config)# domain-name company.local
R1(dhcp-config)# lease 7         ! اعتبار ۷ روزه
\`\`\`

## DHCP Relay (برای شبکه‌های چندگانه)
وقتی سرور DHCP در یک Subnet دیگر است:
\`\`\`
R1(config)# interface gi0/1
R1(config-if)# ip helper-address 192.168.100.10
\`\`\`

## بررسی DHCP
\`\`\`
R1# show ip dhcp pool              ! اطلاعات Pool
R1# show ip dhcp binding           ! IP‌های اختصاص داده شده
R1# show ip dhcp statistics        ! آمار
R1# show ip dhcp conflict          ! تعارضات IP
\`\`\`

## رزرو IP برای یک دستگاه خاص
\`\`\`
R1(config)# ip dhcp pool PRINTER
R1(dhcp-config)# host 192.168.1.50 255.255.255.0
R1(dhcp-config)# hardware-address 00AA.BBCC.DDEE
R1(dhcp-config)# default-router 192.168.1.1
\`\`\``,
  'cisco-basics', 11, 0)

post('stp-spanning-tree',
  'STP — Spanning Tree Protocol Explained',
  'STP — پروتکل درخت فراگیر به زبان ساده',
  'STP prevents network loops in switched networks. Learn how it works and how to configure it.',
  'STP از حلقه‌های شبکه در شبکه‌های سوئیچ‌شده جلوگیری می‌کند. یاد بگیرید چگونه کار می‌کند.',
  `## What is STP?
STP (Spanning Tree Protocol) prevents Layer 2 loops in networks with redundant switch links. Without STP, broadcast storms would crash your network.

## How STP Works
1. **Root Bridge Election**: Switch with lowest Bridge ID becomes root
2. **Root Ports**: Each non-root switch's best port to root
3. **Designated Ports**: Best port on each network segment
4. **Blocked Ports**: All other ports — no data traffic

## STP Port States
- **Blocking**: Receives BPDUs, no traffic
- **Listening**: Sending/receiving BPDUs
- **Learning**: Building MAC table
- **Forwarding**: Normal operation
- **Disabled**: Admin disabled

## Configure Root Bridge
\`\`\`
SW1(config)# spanning-tree vlan 1 priority 4096
! Or use macro:
SW1(config)# spanning-tree vlan 1 root primary
SW2(config)# spanning-tree vlan 1 root secondary
\`\`\`

## PortFast (for end devices)
\`\`\`
SW1(config)# interface fa0/1
SW1(config-if)# spanning-tree portfast
SW1(config-if)# spanning-tree bpduguard enable
\`\`\`

## Verify STP
\`\`\`
SW1# show spanning-tree vlan 1
SW1# show spanning-tree summary
\`\`\``,
  `## STP چیست؟
STP (پروتکل درخت فراگیر) از حلقه‌های لایه ۲ در شبکه‌هایی با لینک‌های سوئیچ افزونه جلوگیری می‌کند. بدون STP، طوفان‌های Broadcast شبکه شما را از کار می‌اندازد.

## چرا حلقه خطرناک است؟
تصور کنید دو سوئیچ با دو کابل به هم متصل هستند. یک Broadcast از یک دستگاه به هر دو پورت می‌رود، هر سوئیچ آن را دوباره می‌فرستد و این ادامه پیدا می‌کند تا شبکه کاملاً مسدود شود.

## نحوه کار STP
1. **انتخاب Root Bridge**: سوئیچ با کمترین Bridge ID ریشه می‌شود
2. **Root Ports**: بهترین پورت هر سوئیچ به سمت ریشه
3. **Designated Ports**: بهترین پورت در هر بخش شبکه
4. **Blocked Ports**: سایر پورت‌ها — بدون ترافیک داده

## حالت‌های پورت STP
- **Blocking**: دریافت BPDU، بدون ترافیک
- **Listening**: ارسال/دریافت BPDU
- **Learning**: ساخت جدول MAC
- **Forwarding**: عملکرد عادی
- **Disabled**: غیرفعال توسط مدیر

## پیکربندی Root Bridge
\`\`\`
SW1(config)# spanning-tree vlan 1 priority 4096
! یا استفاده از دستور ساده‌تر:
SW1(config)# spanning-tree vlan 1 root primary
SW2(config)# spanning-tree vlan 1 root secondary
\`\`\`

## PortFast (برای دستگاه‌های کاربری)
\`\`\`
SW1(config)# interface fa0/1
SW1(config-if)# spanning-tree portfast
SW1(config-if)# spanning-tree bpduguard enable
\`\`\`

## بررسی STP
\`\`\`
SW1# show spanning-tree vlan 1
SW1# show spanning-tree summary
SW1# show spanning-tree detail
\`\`\``,
  'cisco-basics', 12, 0)

post('etherchannel-lacp',
  'EtherChannel — Bundling Links for Speed and Redundancy',
  'EtherChannel — ترکیب لینک‌ها برای سرعت و افزونگی',
  'EtherChannel combines multiple physical links into one logical link for more bandwidth.',
  'EtherChannel چندین لینک فیزیکی را به یک لینک منطقی ترکیب می‌کند.',
  `## What is EtherChannel?
EtherChannel (also called Link Aggregation) bundles 2-8 physical links into a single logical link, providing higher bandwidth and redundancy.

## Benefits
- **More bandwidth**: 2x, 4x, or 8x the speed
- **Redundancy**: If one link fails, others continue
- **STP treats as one link**: No blocked ports

## Protocols
- **LACP** (IEEE 802.3ad): Open standard, recommended
- **PAgP**: Cisco proprietary

## Configure EtherChannel with LACP
\`\`\`
! On SW1
SW1(config)# interface range gi0/1-2
SW1(config-if-range)# channel-group 1 mode active
SW1(config-if-range)# exit
SW1(config)# interface port-channel 1
SW1(config-if)# switchport mode trunk
SW1(config-if)# switchport trunk allowed vlan 10,20,30

! On SW2
SW2(config)# interface range gi0/1-2
SW2(config-if-range)# channel-group 1 mode passive
\`\`\`

## Verify EtherChannel
\`\`\`
SW1# show etherchannel summary
SW1# show etherchannel port-channel
\`\`\``,
  `## EtherChannel چیست؟
EtherChannel (همچنین به آن Link Aggregation گفته می‌شود) 2 تا 8 لینک فیزیکی را در یک لینک منطقی واحد ترکیب می‌کند و پهنای باند و افزونگی بیشتری فراهم می‌کند.

## مزایا
- **پهنای باند بیشتر**: 2 برابر، 4 برابر یا 8 برابر سرعت
- **افزونگی**: اگر یک لینک خراب شود، بقیه ادامه می‌دهند
- **STP آن را یک لینک می‌بیند**: بدون پورت مسدود شده

## پروتکل‌ها
- **LACP** (IEEE 802.3ad): استاندارد باز، توصیه می‌شود
- **PAgP**: اختصاصی سیسکو

## پیکربندی EtherChannel با LACP
\`\`\`
! روی SW1
SW1(config)# interface range gi0/1-2
SW1(config-if-range)# channel-group 1 mode active    ! LACP active
SW1(config-if-range)# exit
SW1(config)# interface port-channel 1
SW1(config-if)# switchport mode trunk
SW1(config-if)# switchport trunk allowed vlan 10,20,30

! روی SW2
SW2(config)# interface range gi0/1-2
SW2(config-if-range)# channel-group 1 mode passive   ! LACP passive
\`\`\`

## بررسی EtherChannel
\`\`\`
SW1# show etherchannel summary          ! خلاصه وضعیت
SW1# show etherchannel port-channel     ! جزئیات
SW1# show lacp neighbor                 ! اطلاعات LACP
\`\`\`

## نکات مهم
- هر دو سر باید پیکربندی یکسان داشته باشند (VLAN، Speed، Duplex)
- حداکثر ۸ پورت در یک EtherChannel
- یک طرف باید active و طرف دیگر می‌تواند active یا passive باشد`,
  'cisco-basics', 11, 0)

post('eigrp-routing-protocol',
  'EIGRP — Cisco Enhanced Interior Gateway Routing Protocol',
  'EIGRP — پروتکل مسیریابی پیشرفته سیسکو',
  'EIGRP is a fast, efficient Cisco routing protocol. Learn to configure it easily.',
  'EIGRP یک پروتکل مسیریابی سریع و کارآمد سیسکو است. پیکربندی آن را یاد بگیرید.',
  `## What is EIGRP?
EIGRP (Enhanced Interior Gateway Routing Protocol) is an advanced Cisco proprietary (now open standard) routing protocol that combines features of distance-vector and link-state protocols.

## EIGRP Advantages
- Very fast convergence (DUAL algorithm)
- Low bandwidth usage
- Supports unequal-cost load balancing
- Easy to configure

## Basic EIGRP Configuration
\`\`\`
R1(config)# router eigrp 100
R1(config-router)# eigrp router-id 1.1.1.1
R1(config-router)# network 192.168.1.0 0.0.0.255
R1(config-router)# network 10.0.0.0 0.0.0.3
R1(config-router)# no auto-summary
R1(config-router)# passive-interface gi0/1
\`\`\`

\`\`\`
R2(config)# router eigrp 100
R2(config-router)# eigrp router-id 2.2.2.2
R2(config-router)# network 192.168.2.0 0.0.0.255
R2(config-router)# network 10.0.0.0 0.0.0.3
R2(config-router)# no auto-summary
\`\`\`

## Verify EIGRP
\`\`\`
R1# show ip eigrp neighbors
R1# show ip eigrp topology
R1# show ip route eigrp
\`\`\``,
  `## EIGRP چیست؟
EIGRP (پروتکل مسیریابی پیشرفته دروازه داخلی) یک پروتکل مسیریابی پیشرفته سیسکو (اکنون استاندارد باز) است که ویژگی‌های پروتکل‌های Distance-Vector و Link-State را ترکیب می‌کند.

## مزایای EIGRP
- همگرایی بسیار سریع (الگوریتم DUAL)
- مصرف پهنای باند کم
- پشتیبانی از load balancing با هزینه نابرابر
- پیکربندی آسان

## پیکربندی پایه EIGRP
\`\`\`
R1(config)# router eigrp 100
R1(config-router)# eigrp router-id 1.1.1.1
R1(config-router)# network 192.168.1.0 0.0.0.255
R1(config-router)# network 10.0.0.0 0.0.0.3
R1(config-router)# no auto-summary
R1(config-router)# passive-interface gi0/1
\`\`\`

\`\`\`
R2(config)# router eigrp 100
R2(config-router)# eigrp router-id 2.2.2.2
R2(config-router)# network 192.168.2.0 0.0.0.255
R2(config-router)# network 10.0.0.0 0.0.0.3
R2(config-router)# no auto-summary
\`\`\`

## بررسی EIGRP
\`\`\`
R1# show ip eigrp neighbors        ! همسایگان EIGRP
R1# show ip eigrp topology         ! توپولوژی
R1# show ip route eigrp            ! مسیرهای EIGRP
R1# show ip eigrp traffic          ! آمار ترافیک
\`\`\`

## تفاوت EIGRP با OSPF
| ویژگی | EIGRP | OSPF |
|-------|-------|------|
| نوع | Hybrid | Link-State |
| استاندارد | سیسکو (اکنون باز) | باز (IEEE) |
| متریک | Bandwidth + Delay | Cost (Bandwidth) |
| همگرایی | بسیار سریع | سریع |
| پیچیدگی | کم | متوسط |`,
  'cisco-basics', 12, 0)

post('hsrp-fhrp',
  'HSRP — High Availability Gateway with Cisco',
  'HSRP — دروازه با دسترس‌پذیری بالا در سیسکو',
  'HSRP provides redundant default gateways so users stay connected if a router fails.',
  'HSRP دروازه‌های پیش‌فرض افزونه ارائه می‌دهد تا کاربران در صورت خرابی روتر متصل بمانند.',
  `## What is HSRP?
HSRP (Hot Standby Router Protocol) allows two or more routers to share a virtual IP address as the default gateway. If the active router fails, the standby takes over seamlessly.

## HSRP Configuration
\`\`\`
! R1 — Active Router (higher priority)
R1(config)# interface gi0/1
R1(config-if)# ip address 192.168.1.2 255.255.255.0
R1(config-if)# standby 1 ip 192.168.1.1
R1(config-if)# standby 1 priority 110
R1(config-if)# standby 1 preempt
R1(config-if)# standby 1 authentication md5 key-string SecretKey

! R2 — Standby Router (lower priority)
R2(config)# interface gi0/1
R2(config-if)# ip address 192.168.1.3 255.255.255.0
R2(config-if)# standby 1 ip 192.168.1.1
R2(config-if)# standby 1 priority 100
\`\`\`

## Verify HSRP
\`\`\`
R1# show standby brief
R1# show standby
\`\`\`

## HSRP Versions
- HSRPv1: Default, multicast 224.0.0.2
- HSRPv2: Supports IPv6, multicast 224.0.0.102`,
  `## HSRP چیست؟
HSRP (پروتکل روتر آماده به کار گرم) به دو یا چند روتر اجازه می‌دهد یک آدرس IP مجازی را به عنوان دروازه پیش‌فرض به اشتراک بگذارند. اگر روتر فعال خراب شود، روتر آماده به کار بدون قطعی کنترل را می‌گیرد.

## چرا HSRP مهم است؟
بدون HSRP، اگر روتر پیش‌فرض شبکه خراب شود، تمام کاربران از اینترنت قطع می‌شوند. با HSRP، روتر دوم در عرض چند ثانیه کنترل را می‌گیرد.

## پیکربندی HSRP
\`\`\`
! R1 — روتر فعال (اولویت بالاتر)
R1(config)# interface gi0/1
R1(config-if)# ip address 192.168.1.2 255.255.255.0
R1(config-if)# standby 1 ip 192.168.1.1      ! IP مجازی مشترک
R1(config-if)# standby 1 priority 110
R1(config-if)# standby 1 preempt             ! برگشت به فعال بعد از بازیابی
R1(config-if)# standby 1 authentication md5 key-string SecretKey

! R2 — روتر آماده به کار (اولویت پایین‌تر)
R2(config)# interface gi0/1
R2(config-if)# ip address 192.168.1.3 255.255.255.0
R2(config-if)# standby 1 ip 192.168.1.1
R2(config-if)# standby 1 priority 100
\`\`\`

## بررسی HSRP
\`\`\`
R1# show standby brief             ! خلاصه وضعیت
R1# show standby                   ! جزئیات کامل
\`\`\`

## کاربران چه IP ای را می‌زنند؟
کاربران IP مجازی (192.168.1.1) را به عنوان Default Gateway تنظیم می‌کنند، نه IP واقعی روترها.`,
  'cisco-basics', 11, 0)

post('ssh-telnet-cisco',
  'Secure Remote Access to Cisco — SSH vs Telnet',
  'دسترسی از راه دور امن به سیسکو — SSH در مقابل Telnet',
  'Learn to configure SSH for secure remote management of Cisco devices.',
  'SSH را برای مدیریت از راه دور امن دستگاه‌های سیسکو پیکربندی کنید.',
  `## SSH vs Telnet

| Feature | SSH | Telnet |
|---------|-----|--------|
| Encryption | Yes (encrypted) | No (plaintext) |
| Port | 22 | 23 |
| Security | Secure | Insecure |
| Recommendation | Always use | Never use in production |

## Configure SSH on Cisco
\`\`\`
R1(config)# hostname R1
R1(config)# ip domain-name company.local
R1(config)# crypto key generate rsa modulus 2048
R1(config)# ip ssh version 2
R1(config)# ip ssh time-out 60
R1(config)# ip ssh authentication-retries 3

R1(config)# username admin privilege 15 secret StrongPass123

R1(config)# line vty 0 15
R1(config-line)# login local
R1(config-line)# transport input ssh
R1(config-line)# exec-timeout 10 0
\`\`\`

## Verify SSH
\`\`\`
R1# show ip ssh
R1# show ssh
\`\`\`

## Connect from PC
\`\`\`
ssh -l admin 192.168.1.1
\`\`\``,
  `## SSH در مقابل Telnet

| ویژگی | SSH | Telnet |
|-------|-----|--------|
| رمزگذاری | بله (رمزگذاری شده) | خیر (متن ساده) |
| پورت | 22 | 23 |
| امنیت | امن | ناامن |
| توصیه | همیشه استفاده کنید | هرگز در محیط تولید |

## چرا Telnet خطرناک است؟
با Telnet، تمام داده‌ها — از جمله نام کاربری و رمز عبور — به صورت متن ساده از طریق شبکه ارسال می‌شوند. هر کسی که ترافیک شبکه را ضبط کند می‌تواند اعتبارنامه‌های شما را ببیند.

## پیکربندی SSH در سیسکو
\`\`\`
R1(config)# hostname R1                              ! نام میزبان باید تنظیم شود
R1(config)# ip domain-name company.local             ! دامنه باید تنظیم شود
R1(config)# crypto key generate rsa modulus 2048     ! کلید رمزگذاری
R1(config)# ip ssh version 2
R1(config)# ip ssh time-out 60
R1(config)# ip ssh authentication-retries 3

R1(config)# username admin privilege 15 secret StrongPass123

R1(config)# line vty 0 15
R1(config-line)# login local
R1(config-line)# transport input ssh                 ! فقط SSH مجاز
R1(config-line)# exec-timeout 10 0                  ! قطع ارتباط بعد از ۱۰ دقیقه
\`\`\`

## بررسی SSH
\`\`\`
R1# show ip ssh              ! وضعیت SSH
R1# show ssh                 ! اتصالات فعال
\`\`\`

## اتصال از کامپیوتر
\`\`\`
ssh admin@192.168.1.1
\`\`\``,
  'cisco-basics', 10, 0)

post('cisco-ios-commands',
  'Essential Cisco IOS Commands Every Engineer Must Know',
  'دستورات ضروری IOS سیسکو که هر مهندس باید بداند',
  'Master the most important Cisco IOS commands for daily network management.',
  'مهم‌ترین دستورات IOS سیسکو برای مدیریت روزانه شبکه را یاد بگیرید.',
  `## Cisco IOS Command Modes

| Mode | Prompt | Access |
|------|--------|--------|
| User EXEC | Router> | Login |
| Privileged EXEC | Router# | enable |
| Global Config | Router(config)# | configure terminal |
| Interface Config | Router(config-if)# | interface |

## Navigation Commands
\`\`\`
Router> enable               ! Enter privileged mode
Router# configure terminal   ! Enter config mode
Router(config)# exit         ! Go back one level
Router(config)# end          ! Return to privileged mode
Router# disable              ! Return to user mode
\`\`\`

## Show Commands (Most Important)
\`\`\`
# show version               ! IOS version, uptime, hardware
# show running-config        ! Current configuration
# show startup-config        ! Saved configuration
# show ip interface brief    ! Interface status and IPs
# show ip route              ! Routing table
# show interfaces            ! Detailed interface info
# show cdp neighbors detail  ! Connected Cisco devices
# show processes cpu         ! CPU utilization
# show memory                ! Memory usage
\`\`\`

## Save and Backup
\`\`\`
# write memory               ! Save config
# copy running-config tftp   ! Backup to TFTP server
# copy tftp running-config   ! Restore from TFTP
\`\`\``,
  `## حالت‌های دستور IOS سیسکو

| حالت | نماد | دسترسی |
|------|------|---------|
| User EXEC | Router> | ورود |
| Privileged EXEC | Router# | enable |
| Global Config | Router(config)# | configure terminal |
| Interface Config | Router(config-if)# | interface |

## دستورات ناوبری
\`\`\`
Router> enable               ! ورود به حالت Privileged
Router# configure terminal   ! ورود به حالت پیکربندی
Router(config)# exit         ! برگشت یک سطح
Router(config)# end          ! برگشت به Privileged
Router# disable              ! برگشت به User mode
\`\`\`

## دستورات Show (مهم‌ترین‌ها)
\`\`\`
show version                  ! نسخه IOS، آپتایم، سخت‌افزار
show running-config           ! پیکربندی فعلی
show startup-config           ! پیکربندی ذخیره‌شده
show ip interface brief       ! وضعیت اینترفیس‌ها و IP‌ها
show ip route                 ! جدول مسیریابی
show interfaces               ! اطلاعات جامع اینترفیس
show cdp neighbors detail     ! دستگاه‌های سیسکو متصل
show processes cpu            ! مصرف CPU
show memory                   ! مصرف حافظه
show clock                    ! زمان سیستم
\`\`\`

## ذخیره و پشتیبان‌گیری
\`\`\`
write memory                  ! ذخیره پیکربندی
copy running-config startup-config  ! ذخیره (روش دیگر)
copy running-config tftp      ! پشتیبان‌گیری به TFTP
copy tftp running-config      ! بازیابی از TFTP
\`\`\`

## دستورات Debug و عیب‌یابی
\`\`\`
ping 8.8.8.8                  ! تست اتصال
traceroute 8.8.8.8            ! ردیابی مسیر
debug ip ospf events          ! دیباگ OSPF
undebug all                   ! خاموش کردن همه debug
\`\`\``,
  'cisco-basics', 10, 0)

post('wan-technologies',
  'WAN Technologies — Connecting Remote Sites',
  'فناوری‌های WAN — اتصال سایت‌های راه دور',
  'Learn about different WAN technologies used to connect branch offices.',
  'فناوری‌های مختلف WAN برای اتصال شعبات راه دور را بیاموزید.',
  `## What is WAN?
WAN (Wide Area Network) connects geographically separated networks — typically branch offices to headquarters or connecting to the internet.

## Common WAN Technologies

### 1. Leased Line (Dedicated)
- Dedicated point-to-point connection
- Always available, high cost
- Uses: HDLC, PPP protocols
- Speeds: T1 (1.5 Mbps) to STM-64 (10 Gbps)

### 2. DSL / Broadband
- Over telephone lines
- Asymmetric (download faster than upload)
- Lower cost, widely available

### 3. MPLS (Multi-Protocol Label Switching)
- Service provider managed
- Layer 2.5 — between L2 and L3
- QoS guaranteed, enterprise-grade
- Most common for enterprise WAN

### 4. SD-WAN (Software-Defined WAN)
- Modern approach — uses multiple links (MPLS, broadband, 4G/5G)
- Intelligent routing based on application
- Cisco Viptela/SD-WAN solution

## PPP Configuration
\`\`\`
R1(config)# interface serial0/0
R1(config-if)# encapsulation ppp
R1(config-if)# ppp authentication chap
R1(config-if)# ip address 10.0.0.1 255.255.255.252
R1(config-if)# no shutdown
\`\`\``,
  `## WAN چیست؟
WAN (شبکه گسترده) شبکه‌هایی را که از نظر جغرافیایی از هم جدا هستند متصل می‌کند — معمولاً دفاتر شعبه به مرکز اصلی یا اتصال به اینترنت.

## فناوری‌های رایج WAN

### ۱. Leased Line (اختصاصی)
- اتصال نقطه به نقطه اختصاصی
- همیشه در دسترس، هزینه بالا
- پروتکل‌ها: HDLC، PPP
- سرعت: T1 (1.5 مگابیت) تا STM-64 (10 گیگابیت)

### ۲. DSL / باند پهن
- از طریق خطوط تلفن
- نامتقارن (دانلود سریع‌تر از آپلود)
- هزینه کمتر، گسترده‌تر

### ۳. MPLS (سوئیچینگ برچسب چندپروتکلی)
- مدیریت شده توسط ارائه‌دهنده خدمات
- لایه ۲.۵
- QoS تضمین شده، سطح سازمانی
- رایج‌ترین برای WAN سازمانی

### ۴. SD-WAN (WAN نرم‌افزار محور)
- رویکرد مدرن — از چندین لینک استفاده می‌کند (MPLS، باند پهن، 4G/5G)
- مسیریابی هوشمند بر اساس اپلیکیشن
- راه‌حل Cisco Viptela/SD-WAN

## پیکربندی PPP
\`\`\`
R1(config)# interface serial0/0
R1(config-if)# encapsulation ppp
R1(config-if)# ppp authentication chap
R1(config-if)# ip address 10.0.0.1 255.255.255.252
R1(config-if)# no shutdown
\`\`\`

## مقایسه گزینه‌های WAN
| فناوری | هزینه | سرعت | قابلیت اطمینان |
|--------|-------|------|----------------|
| Leased Line | بالا | بالا | عالی |
| DSL | پایین | متوسط | متوسط |
| MPLS | بالا-متوسط | بالا | خوب |
| SD-WAN | متوسط | متغیر | خوب |`,
  'cisco-basics', 13, 0)

post('cisco-qos',
  'QoS on Cisco — Prioritizing Critical Network Traffic',
  'QoS در سیسکو — اولویت‌بندی ترافیک مهم شبکه',
  'Quality of Service ensures voice and video traffic gets priority over regular data.',
  'کیفیت سرویس تضمین می‌کند ترافیک صوتی و تصویری نسبت به داده‌های عادی اولویت دارد.',
  `## What is QoS?
QoS (Quality of Service) is a set of technologies that work on a network to guarantee a certain level of performance for data flows. It prioritizes critical traffic like VoIP and video over regular data.

## Why QoS?
Without QoS, all traffic is treated equally — a large file download could delay VoIP calls, causing choppy audio.

## QoS Models
1. **Best Effort**: No QoS — first in, first out
2. **IntServ**: Per-flow reservation (RSVP) — very complex
3. **DiffServ**: Traffic classification and marking — most common

## QoS Implementation Steps
1. **Classify**: Identify traffic types (VoIP, video, data)
2. **Mark**: Tag packets (DSCP values)
3. **Police/Shape**: Limit bandwidth per class
4. **Queue**: Schedule output

## Basic QoS with MQC
\`\`\`
! Define class maps
R1(config)# class-map match-any VOICE
R1(config-cmap)# match dscp ef

R1(config)# class-map match-any VIDEO
R1(config-cmap)# match dscp af41

! Define policy map
R1(config)# policy-map WAN-QoS
R1(config-pmap)# class VOICE
R1(config-pmap-c)# priority 512    ! 512kbps guaranteed
R1(config-pmap)# class VIDEO
R1(config-pmap-c)# bandwidth 1024
R1(config-pmap)# class class-default
R1(config-pmap-c)# fair-queue

! Apply to interface
R1(config)# interface gi0/0
R1(config-if)# service-policy output WAN-QoS
\`\`\``,
  `## QoS چیست؟
QoS (کیفیت سرویس) مجموعه‌ای از فناوری‌هاست که در شبکه برای تضمین سطح معینی از عملکرد برای جریان‌های داده کار می‌کند. ترافیک حیاتی مانند VoIP و ویدئو را نسبت به داده‌های عادی اولویت می‌دهد.

## چرا QoS؟
بدون QoS، تمام ترافیک به یک اندازه رفتار می‌شود — یک دانلود فایل بزرگ می‌تواند تماس‌های VoIP را با تأخیر مواجه کند و کیفیت صدا را خراب کند.

## مراحل پیاده‌سازی QoS
1. **طبقه‌بندی**: شناسایی انواع ترافیک (VoIP، ویدئو، داده)
2. **نشانه‌گذاری**: برچسب‌زدن پکت‌ها (مقادیر DSCP)
3. **محدودیت/شکل‌دهی**: محدود کردن پهنای باند برای هر کلاس
4. **صف‌بندی**: زمان‌بندی خروجی

## مقادیر DSCP مهم
| مقدار | نام | کاربرد |
|-------|-----|---------|
| EF (46) | Expedited Forwarding | VoIP |
| AF41 (34) | Assured Forwarding | ویدئوی تعاملی |
| AF21 | Assured Forwarding | داده سازمانی |
| CS0 (0) | Best Effort | ترافیک معمولی |

## پیکربندی پایه QoS
\`\`\`
! تعریف Class Map
R1(config)# class-map match-any VOICE
R1(config-cmap)# match dscp ef

R1(config)# class-map match-any VIDEO
R1(config-cmap)# match dscp af41

! تعریف Policy Map
R1(config)# policy-map WAN-QoS
R1(config-pmap)# class VOICE
R1(config-pmap-c)# priority 512          ! ۵۱۲ کیلوبیت تضمینی
R1(config-pmap)# class VIDEO
R1(config-pmap-c)# bandwidth 1024
R1(config-pmap)# class class-default
R1(config-pmap-c)# fair-queue

! اعمال به اینترفیس
R1(config)# interface gi0/0
R1(config-if)# service-policy output WAN-QoS
\`\`\``,
  'cisco-basics', 13, 0)

post('cisco-network-management',
  'Cisco Network Management — Monitoring and Maintenance',
  'مدیریت شبکه سیسکو — مانیتورینگ و نگهداری',
  'Learn best practices for managing and maintaining a Cisco network infrastructure.',
  'بهترین روش‌های مدیریت و نگهداری زیرساخت شبکه سیسکو را یاد بگیرید.',
  `## Network Management Overview

Effective network management covers: monitoring, configuration, fault detection, performance, and security.

## CDP — Cisco Discovery Protocol
\`\`\`
R1# show cdp neighbors detail     ! See all connected Cisco devices
R1# show cdp neighbors           ! Summary view
\`\`\`

## NTP — Time Synchronization
\`\`\`
R1(config)# ntp server 0.us.pool.ntp.org
R1(config)# ntp server 1.us.pool.ntp.org
R1(config)# clock timezone IRST 3 30    ! Iran Standard Time
R1# show ntp status
R1# show clock detail
\`\`\`

## Syslog Configuration
\`\`\`
R1(config)# logging host 192.168.1.100   ! Syslog server
R1(config)# logging trap informational
R1(config)# service timestamps log datetime msec localtime
\`\`\`

## IOS Upgrade
\`\`\`
R1# show flash:                         ! Current IOS
R1# copy tftp flash                     ! Copy new IOS from TFTP
R1(config)# boot system flash:newios.bin
R1# reload
\`\`\`

## Network Baseline
Document normal values:
- CPU: <70% average
- Memory: <80% used
- Interface errors: <0.1%
- Bandwidth utilization: <70%`,
  `## مروری بر مدیریت شبکه

مدیریت شبکه موثر شامل: مانیتورینگ، پیکربندی، تشخیص خطا، عملکرد و امنیت است.

## CDP — پروتکل کشف سیسکو
\`\`\`
R1# show cdp neighbors detail     ! همه دستگاه‌های سیسکو متصل
R1# show cdp neighbors            ! نمای خلاصه
R1# show cdp entry *              ! جزئیات کامل
\`\`\`

## NTP — همگام‌سازی زمان
\`\`\`
R1(config)# ntp server 0.us.pool.ntp.org
R1(config)# ntp server 1.us.pool.ntp.org
R1(config)# clock timezone IRST 3 30    ! وقت ایران
R1# show ntp status
R1# show clock detail
\`\`\`

## پیکربندی Syslog
\`\`\`
R1(config)# logging host 192.168.1.100   ! سرور Syslog
R1(config)# logging trap informational
R1(config)# service timestamps log datetime msec localtime
R1# show logging
\`\`\`

## ارتقاء IOS
\`\`\`
R1# show flash:                         ! IOS فعلی
R1# copy tftp flash                     ! کپی IOS جدید از TFTP
R1(config)# boot system flash:newios.bin
R1# reload
\`\`\`

## مستندسازی شبکه
مقادیر پایه را ثبت کنید:
- CPU: کمتر از ۷۰٪ میانگین
- حافظه: کمتر از ۸۰٪ استفاده شده
- خطاهای اینترفیس: کمتر از ۰.۱٪
- استفاده از پهنای باند: کمتر از ۷۰٪

## ابزارهای مدیریت مفید
- **Cisco Prime Infrastructure**: مدیریت یکپارچه شبکه
- **SolarWinds**: مانیتورینگ SNMP
- **PRTG**: مانیتورینگ و هشدار
- **Wireshark**: تحلیل ترافیک`,
  'cisco-basics', 12, 0)

console.log('✅ Section 1 done — 20 Cisco basics posts inserted')

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — امنیت شبکه (10 پست)
// ══════════════════════════════════════════════════════════════════════════════

post('network-security-intro',
  'Introduction to Network Security — Why It Matters',
  'مقدمه‌ای بر امنیت شبکه — چرا مهم است؟',
  'Understanding the fundamentals of network security and common threats.',
  'مبانی امنیت شبکه و تهدیدات رایج را بشناسید.',
  `## Why Network Security?
Every day, millions of cyberattacks target networks worldwide. A single breach can cost millions and destroy a company's reputation.

## The CIA Triad
- **Confidentiality**: Only authorized users access data
- **Integrity**: Data is not modified in transit
- **Availability**: Systems are always accessible to authorized users

## Common Threats
| Threat | Description |
|--------|-------------|
| DoS/DDoS | Flooding a system to deny service |
| Man-in-the-Middle | Intercepting communications |
| Phishing | Tricking users to reveal credentials |
| Ransomware | Encrypting data and demanding payment |
| Port Scanning | Discovering open services |

## Defense in Depth
Use multiple security layers:
1. Perimeter security (firewall)
2. Network security (IDS/IPS, ACLs)
3. Host security (antivirus, patching)
4. Application security (WAF)
5. Data security (encryption)`,
  `## چرا امنیت شبکه؟
هر روز میلیون‌ها حمله سایبری شبکه‌های سراسر جهان را هدف قرار می‌دهند. یک نقض امنیتی می‌تواند میلیون‌ها دلار هزینه داشته باشد و شهرت یک شرکت را نابود کند.

## مثلث CIA
- **محرمانگی (Confidentiality)**: فقط کاربران مجاز به داده دسترسی دارند
- **یکپارچگی (Integrity)**: داده در مسیر انتقال تغییر نمی‌کند
- **دسترس‌پذیری (Availability)**: سیستم‌ها همیشه برای کاربران مجاز قابل دسترس هستند

## تهدیدات رایج
| تهدید | توضیح |
|-------|-------|
| DoS/DDoS | سیل ترافیک برای از کار انداختن سرویس |
| Man-in-the-Middle | رهگیری ارتباطات |
| Phishing | فریب کاربران برای افشای اعتبارنامه |
| Ransomware | رمزگذاری داده و درخواست باج |
| Port Scanning | کشف سرویس‌های باز |

## دفاع عمیق
از چندین لایه امنیتی استفاده کنید:
1. امنیت محیطی (فایروال)
2. امنیت شبکه (IDS/IPS، ACL)
3. امنیت میزبان (آنتی‌ویروس، Patch)
4. امنیت اپلیکیشن (WAF)
5. امنیت داده (رمزگذاری)

## حملات رایج به شبکه سیسکو
- **VLAN Hopping**: دور زدن جداسازی VLAN
- **MAC Flooding**: پر کردن جدول MAC سوئیچ
- **ARP Spoofing**: جعل آدرس MAC
- **STP Manipulation**: دستکاری Spanning Tree`,
  'cisco-security', 10, 1)

post('cisco-acl-complete',
  'Access Control Lists (ACL) — Complete Cisco Guide',
  'لیست‌های کنترل دسترسی (ACL) — راهنمای کامل سیسکو',
  'ACLs filter network traffic based on rules. Learn Standard, Extended, and Named ACLs.',
  'ACLها ترافیک شبکه را بر اساس قوانین فیلتر می‌کنند. انواع ACL را یاد بگیرید.',
  `## What is an ACL?
An Access Control List (ACL) is a set of rules that filter network traffic. Like a security guard checking a list — allow or deny based on rules.

## Types of ACLs
1. **Standard ACL** (1-99, 1300-1999): Filter by source IP only
2. **Extended ACL** (100-199, 2000-2699): Filter by source, destination, protocol, port
3. **Named ACL**: Use descriptive names

## Standard ACL
\`\`\`
! Allow only 192.168.1.0/24, deny everything else
R1(config)# access-list 10 permit 192.168.1.0 0.0.0.255
R1(config)# access-list 10 deny any

! Apply to interface (place near destination)
R1(config)# interface gi0/1
R1(config-if)# ip access-group 10 out
\`\`\`

## Extended ACL
\`\`\`
! Deny Telnet from any source, allow everything else
R1(config)# access-list 110 deny tcp any any eq 23
R1(config)# access-list 110 permit ip any any

! Block specific host from accessing web server
R1(config)# access-list 110 deny tcp host 192.168.1.50 host 10.0.0.100 eq 80

! Apply to interface (place near source)
R1(config)# interface gi0/0
R1(config-if)# ip access-group 110 in
\`\`\`

## Named ACL
\`\`\`
R1(config)# ip access-list extended BLOCK-TELNET
R1(config-ext-nacl)# deny tcp any any eq 23
R1(config-ext-nacl)# permit ip any any
\`\`\`

## Verify ACL
\`\`\`
R1# show access-lists
R1# show ip interface gi0/0
\`\`\``,
  `## ACL چیست؟
لیست کنترل دسترسی (ACL) مجموعه‌ای از قوانین است که ترافیک شبکه را فیلتر می‌کند. مثل یک نگهبان که لیستی را چک می‌کند — بر اساس قوانین مجاز یا ممنوع.

## انواع ACL
1. **ACL استاندارد** (1-99): فیلتر بر اساس IP منبع
2. **ACL توسعه‌یافته** (100-199): فیلتر بر اساس منبع، مقصد، پروتکل، پورت
3. **ACL با نام**: از نام‌های توصیفی استفاده می‌کند

## قوانین مهم ACL
- قوانین از بالا به پایین بررسی می‌شوند
- اولین تطابق اعمال می‌شود
- در انتها همیشه یک «deny any» ضمنی وجود دارد
- ACL استاندارد: نزدیک مقصد اعمال کنید
- ACL توسعه‌یافته: نزدیک منبع اعمال کنید

## ACL استاندارد
\`\`\`
! فقط 192.168.1.0/24 مجاز، بقیه ممنوع
R1(config)# access-list 10 permit 192.168.1.0 0.0.0.255
R1(config)# access-list 10 deny any

! اعمال به اینترفیس
R1(config)# interface gi0/1
R1(config-if)# ip access-group 10 out
\`\`\`

## ACL توسعه‌یافته
\`\`\`
! مسدود کردن Telnet، مجاز کردن بقیه
R1(config)# access-list 110 deny tcp any any eq 23
R1(config)# access-list 110 permit ip any any

! مسدود کردن یک هاست خاص از دسترسی به وب سرور
R1(config)# access-list 110 deny tcp host 192.168.1.50 host 10.0.0.100 eq 80

! اعمال نزدیک منبع
R1(config)# interface gi0/0
R1(config-if)# ip access-group 110 in
\`\`\`

## ACL با نام
\`\`\`
R1(config)# ip access-list extended BLOCK-TELNET
R1(config-ext-nacl)# deny tcp any any eq 23
R1(config-ext-nacl)# permit ip any any
\`\`\`

## بررسی ACL
\`\`\`
R1# show access-lists              ! همه ACLها
R1# show ip interface gi0/0        ! ACL اعمال شده
R1# clear ip access-list counters  ! پاک کردن شمارنده‌ها
\`\`\``,
  'cisco-security', 14, 0)

post('port-security-cisco',
  'Port Security — Prevent Unauthorized Devices on Your Network',
  'Port Security — جلوگیری از دستگاه‌های غیرمجاز در شبکه',
  'Port Security restricts which devices can connect to a switch port.',
  'Port Security محدود می‌کند کدام دستگاه‌ها می‌توانند به پورت سوئیچ متصل شوند.',
  `## What is Port Security?
Port Security allows you to restrict which MAC addresses can connect to a switch port. If an unauthorized device connects, the port is shut down.

## Configuration
\`\`\`
SW1(config)# interface fa0/1
SW1(config-if)# switchport mode access
SW1(config-if)# switchport access vlan 10

! Enable port security
SW1(config-if)# switchport port-security
SW1(config-if)# switchport port-security maximum 2      ! Max 2 MACs
SW1(config-if)# switchport port-security mac-address sticky   ! Learn MACs
SW1(config-if)# switchport port-security violation shutdown   ! Action on violation
\`\`\`

## Violation Modes
| Mode | Action |
|------|--------|
| shutdown | Port goes err-disabled (default) |
| restrict | Drop frames, log, increment counter |
| protect | Drop frames silently |

## Static MAC Address
\`\`\`
SW1(config-if)# switchport port-security mac-address 00AA.BBCC.DDEE
\`\`\`

## Recover from err-disabled
\`\`\`
SW1(config)# interface fa0/1
SW1(config-if)# shutdown
SW1(config-if)# no shutdown
\`\`\`

## Verify
\`\`\`
SW1# show port-security
SW1# show port-security address
SW1# show port-security interface fa0/1
\`\`\``,
  `## Port Security چیست؟
Port Security به شما اجازه می‌دهد محدود کنید کدام آدرس‌های MAC می‌توانند به یک پورت سوئیچ متصل شوند. اگر یک دستگاه غیرمجاز متصل شود، پورت خاموش می‌شود.

## سناریو واقعی
یک کارمند یک سوئیچ شخصی به شبکه سازمانی وصل می‌کند. بدون Port Security، هر دستگاهی می‌تواند به شبکه متصل شود. با Port Security، پورت بلافاصله غیرفعال می‌شود.

## پیکربندی
\`\`\`
SW1(config)# interface fa0/1
SW1(config-if)# switchport mode access
SW1(config-if)# switchport access vlan 10

! فعال‌سازی Port Security
SW1(config-if)# switchport port-security
SW1(config-if)# switchport port-security maximum 2       ! حداکثر ۲ MAC
SW1(config-if)# switchport port-security mac-address sticky   ! یادگیری MAC
SW1(config-if)# switchport port-security violation shutdown   ! اقدام در تخلف
\`\`\`

## حالت‌های تخلف
| حالت | اقدام |
|------|-------|
| shutdown | پورت به err-disabled می‌رود (پیش‌فرض) |
| restrict | رها کردن فریم، لاگ، افزایش شمارنده |
| protect | رها کردن فریم بدون اطلاع |

## بازیابی از err-disabled
\`\`\`
SW1(config)# interface fa0/1
SW1(config-if)# shutdown
SW1(config-if)# no shutdown
\`\`\`

## بررسی
\`\`\`
SW1# show port-security                        ! خلاصه
SW1# show port-security address               ! آدرس‌های MAC مجاز
SW1# show port-security interface fa0/1       ! جزئیات پورت
\`\`\``,
  'cisco-security', 11, 0)

post('dhcp-snooping',
  'DHCP Snooping — Protect Your Network from Rogue DHCP Servers',
  'DHCP Snooping — محافظت از شبکه در برابر سرورهای DHCP مخرب',
  'DHCP Snooping prevents unauthorized DHCP servers from assigning wrong IP addresses.',
  'DHCP Snooping از سرورهای DHCP غیرمجاز که آدرس‌های IP اشتباه می‌دهند جلوگیری می‌کند.',
  `## The Problem: Rogue DHCP Server
An attacker connects a device acting as a DHCP server. Clients receive wrong IP addresses, default gateways, or DNS servers — enabling man-in-the-middle attacks.

## DHCP Snooping Solution
DHCP Snooping marks ports as trusted (uplink) or untrusted (user devices). Only trusted ports can send DHCP server messages.

## Configuration
\`\`\`
SW1(config)# ip dhcp snooping
SW1(config)# ip dhcp snooping vlan 10,20,30
SW1(config)# no ip dhcp snooping information option

! Trust uplink to real DHCP server
SW1(config)# interface gi0/1
SW1(config-if)# ip dhcp snooping trust

! All other ports are untrusted by default
\`\`\`

## DHCP Snooping Binding Table
The switch builds a table: MAC, IP, VLAN, Port — used by DAI later.
\`\`\`
SW1# show ip dhcp snooping binding
SW1# show ip dhcp snooping
\`\`\``,
  `## مشکل: سرور DHCP مخرب
یک مهاجم دستگاهی را متصل می‌کند که به عنوان سرور DHCP عمل می‌کند. کلاینت‌ها آدرس‌های IP اشتباه، دروازه پیش‌فرض یا سرورهای DNS دریافت می‌کنند — این امکان حملات Man-in-the-Middle را فراهم می‌کند.

## راه‌حل DHCP Snooping
DHCP Snooping پورت‌ها را به عنوان معتمد (uplink) یا غیرمعتمد (دستگاه‌های کاربری) علامت‌گذاری می‌کند. فقط پورت‌های معتمد می‌توانند پیام‌های سرور DHCP ارسال کنند.

## پیکربندی
\`\`\`
SW1(config)# ip dhcp snooping
SW1(config)# ip dhcp snooping vlan 10,20,30
SW1(config)# no ip dhcp snooping information option

! اعتماد به uplink سرور DHCP واقعی
SW1(config)# interface gi0/1
SW1(config-if)# ip dhcp snooping trust

! همه پورت‌های دیگر به صورت پیش‌فرض غیرمعتمد هستند
\`\`\`

## جدول Binding DHCP Snooping
سوئیچ یک جدول می‌سازد: MAC، IP، VLAN، پورت — توسط DAI استفاده می‌شود:
\`\`\`
SW1# show ip dhcp snooping binding    ! جدول Binding
SW1# show ip dhcp snooping            ! وضعیت کلی
\`\`\`

## Rate Limiting (اختیاری)
\`\`\`
SW1(config)# interface fa0/1
SW1(config-if)# ip dhcp snooping limit rate 15   ! حداکثر ۱۵ پکت DHCP در ثانیه
\`\`\``,
  'cisco-security', 10, 0)

post('dynamic-arp-inspection',
  'Dynamic ARP Inspection — Stop ARP Spoofing Attacks',
  'Dynamic ARP Inspection — جلوگیری از حملات ARP Spoofing',
  'DAI validates ARP packets to prevent attackers from poisoning ARP caches.',
  'DAI پکت‌های ARP را اعتبارسنجی می‌کند تا از مسموم کردن کش ARP جلوگیری کند.',
  `## ARP Spoofing Attack
ARP has no authentication. An attacker can send fake ARP replies saying "I am the gateway," redirecting all traffic through their machine.

## Dynamic ARP Inspection (DAI)
DAI uses the DHCP Snooping binding table to validate ARP packets. If MAC and IP don't match the binding, the ARP is dropped.

## Configuration (requires DHCP Snooping first)
\`\`\`
! Enable DAI for VLANs
SW1(config)# ip arp inspection vlan 10,20,30

! Trust uplink interfaces
SW1(config)# interface gi0/1
SW1(config-if)# ip arp inspection trust

! Optional: Rate limit ARP on untrusted ports
SW1(config)# interface range fa0/1-24
SW1(config-if-range)# ip arp inspection limit rate 100
\`\`\`

## ARP ACL (for static IP devices)
\`\`\`
SW1(config)# arp access-list STATIC-DEVICES
SW1(config-arp-nacl)# permit ip host 192.168.1.50 mac host 00AA.BBCC.DDEE
SW1(config)# ip arp inspection filter STATIC-DEVICES vlan 10
\`\`\`

## Verify
\`\`\`
SW1# show ip arp inspection
SW1# show ip arp inspection vlan 10
SW1# show ip arp inspection statistics
\`\`\``,
  `## حمله ARP Spoofing
ARP هیچ احراز هویتی ندارد. یک مهاجم می‌تواند پاسخ‌های ARP جعلی ارسال کند که می‌گوید "من دروازه هستم" و تمام ترافیک را از طریق دستگاه خود هدایت کند.

## Dynamic ARP Inspection (DAI)
DAI از جدول Binding DHCP Snooping برای اعتبارسنجی پکت‌های ARP استفاده می‌کند. اگر MAC و IP با Binding مطابقت نداشته باشند، ARP رها می‌شود.

## پیکربندی (نیاز به DHCP Snooping دارد)
\`\`\`
! فعال‌سازی DAI برای VLANها
SW1(config)# ip arp inspection vlan 10,20,30

! اعتماد به اینترفیس‌های uplink
SW1(config)# interface gi0/1
SW1(config-if)# ip arp inspection trust

! اختیاری: محدود کردن ARP در پورت‌های غیرمعتمد
SW1(config)# interface range fa0/1-24
SW1(config-if-range)# ip arp inspection limit rate 100
\`\`\`

## بررسی
\`\`\`
SW1# show ip arp inspection              ! وضعیت کلی
SW1# show ip arp inspection vlan 10      ! جزئیات VLAN
SW1# show ip arp inspection statistics   ! آمار
\`\`\``,
  'cisco-security', 10, 0)

post('cisco-vpn-config',
  'VPN on Cisco — Site-to-Site and Remote Access',
  'VPN در سیسکو — Site-to-Site و دسترسی از راه دور',
  'Learn to configure IPsec VPN for secure connectivity between sites.',
  'IPsec VPN را برای اتصال امن بین سایت‌ها پیکربندی کنید.',
  `## What is VPN?
VPN (Virtual Private Network) creates an encrypted tunnel over the internet, connecting remote sites or users securely.

## Types of VPN
1. **Site-to-Site**: Connects two networks (headquarters to branch)
2. **Remote Access**: Individual users connecting to corporate network
3. **SSL VPN**: Browser-based, no client needed

## Site-to-Site IPsec VPN Configuration

### Phase 1 — ISAKMP
\`\`\`
R1(config)# crypto isakmp policy 10
R1(config-isakmp)# encryption aes 256
R1(config-isakmp)# hash sha256
R1(config-isakmp)# authentication pre-share
R1(config-isakmp)# group 14
R1(config-isakmp)# lifetime 86400
R1(config)# crypto isakmp key VPNSecret123 address 203.0.113.2
\`\`\`

### Phase 2 — IPsec Transform
\`\`\`
R1(config)# crypto ipsec transform-set TSET esp-aes 256 esp-sha-hmac
R1(config)# crypto map VPNMAP 10 ipsec-isakmp
R1(config-crypto-map)# set peer 203.0.113.2
R1(config-crypto-map)# set transform-set TSET
R1(config-crypto-map)# match address VPNACL
R1(config)# access-list VPNACL permit ip 192.168.1.0 0.0.0.255 192.168.2.0 0.0.0.255
R1(config)# interface gi0/0
R1(config-if)# crypto map VPNMAP
\`\`\`

## Verify VPN
\`\`\`
R1# show crypto isakmp sa
R1# show crypto ipsec sa
\`\`\``,
  `## VPN چیست؟
VPN (شبکه خصوصی مجازی) یک تونل رمزگذاری شده بر روی اینترنت ایجاد می‌کند و سایت‌های راه دور یا کاربران را به صورت امن متصل می‌کند.

## انواع VPN
1. **Site-to-Site**: اتصال دو شبکه (مرکز اصلی به شعبه)
2. **Remote Access**: کاربران فردی که به شبکه سازمانی متصل می‌شوند
3. **SSL VPN**: مبتنی بر مرورگر، بدون نیاز به کلاینت

## پیکربندی IPsec VPN Site-to-Site

### فاز ۱ — ISAKMP (توافق کلید)
\`\`\`
R1(config)# crypto isakmp policy 10
R1(config-isakmp)# encryption aes 256
R1(config-isakmp)# hash sha256
R1(config-isakmp)# authentication pre-share
R1(config-isakmp)# group 14
R1(config-isakmp)# lifetime 86400
R1(config)# crypto isakmp key VPNSecret123 address 203.0.113.2
\`\`\`

### فاز ۲ — IPsec Transform
\`\`\`
R1(config)# crypto ipsec transform-set TSET esp-aes 256 esp-sha-hmac
R1(config)# crypto map VPNMAP 10 ipsec-isakmp
R1(config-crypto-map)# set peer 203.0.113.2
R1(config-crypto-map)# set transform-set TSET
R1(config-crypto-map)# match address VPNACL
R1(config)# access-list VPNACL permit ip 192.168.1.0 0.0.0.255 192.168.2.0 0.0.0.255
R1(config)# interface gi0/0
R1(config-if)# crypto map VPNMAP
\`\`\`

## بررسی VPN
\`\`\`
R1# show crypto isakmp sa              ! وضعیت فاز ۱
R1# show crypto ipsec sa               ! وضعیت فاز ۲
R1# show crypto map                    ! پیکربندی Crypto Map
\`\`\``,
  'cisco-security', 14, 0)

post('cisco-ids-ips',
  'IDS and IPS on Cisco — Detecting and Preventing Intrusions',
  'IDS و IPS در سیسکو — تشخیص و جلوگیری از نفوذ',
  'Learn the difference between IDS and IPS and how to implement them in Cisco environments.',
  'تفاوت IDS و IPS را بیاموزید و نحوه پیاده‌سازی آنها در محیط‌های سیسکو را یاد بگیرید.',
  `## IDS vs IPS
| Feature | IDS | IPS |
|---------|-----|-----|
| Position | Out of band | Inline |
| Response | Alert only | Block + Alert |
| Impact on traffic | None | Slight latency |
| Risk | Miss but no disruption | May block legitimate traffic |

## Cisco IPS Solutions
- **Cisco Firepower NGIPS**: Next-gen intrusion prevention
- **Cisco IOS IPS**: Basic IPS built into IOS

## Detection Methods
1. **Signature-based**: Match known attack patterns
2. **Anomaly-based**: Detect deviation from baseline
3. **Policy-based**: Enforce security policies

## Cisco IOS IPS Basic Config
\`\`\`
R1(config)# ip ips name IPS-RULE
R1(config-ips)# retired false

R1(config)# interface gi0/0
R1(config-if)# ip ips IPS-RULE in

R1# show ip ips all
R1# show ip ips signatures
\`\`\`

## Best Practice
Deploy Cisco Firepower NGFW/NGIPS for production environments — it provides:
- Deep packet inspection
- Application visibility and control
- URL filtering
- Malware protection`,
  `## IDS در مقابل IPS
| ویژگی | IDS | IPS |
|-------|-----|-----|
| موقعیت | خارج از مسیر | در مسیر (Inline) |
| پاسخ | فقط هشدار | مسدود کردن + هشدار |
| تأثیر بر ترافیک | هیچ | تأخیر کمی |
| ریسک | از دست دادن حمله | ممکن است ترافیک قانونی مسدود شود |

## روش‌های تشخیص
1. **مبتنی بر امضا**: تطبیق با الگوهای حمله شناخته‌شده
2. **مبتنی بر ناهنجاری**: تشخیص انحراف از خط پایه
3. **مبتنی بر سیاست**: اجرای سیاست‌های امنیتی

## راه‌حل‌های IPS سیسکو
- **Cisco Firepower NGIPS**: جلوگیری از نفوذ نسل بعدی
- **Cisco IOS IPS**: IPS پایه داخل IOS

## نکات مهم عملیاتی
1. **Tuning**: تنظیم دقیق امضاها برای کاهش False Positive
2. **بروزرسانی**: همیشه امضاها را به‌روز نگه دارید
3. **مانیتورینگ**: لاگ‌ها را به طور منظم بررسی کنید
4. **آزمایش**: در محیط آزمایش قبل از تولید تست کنید`,
  'cisco-security', 12, 0)

post('802-1x-authentication',
  '802.1X Authentication — Network Access Control',
  '802.1X — کنترل دسترسی به شبکه',
  '802.1X ensures only authenticated users and devices can connect to your network.',
  '802.1X تضمین می‌کند فقط کاربران و دستگاه‌های احراز هویت‌شده می‌توانند به شبکه متصل شوند.',
  `## What is 802.1X?
802.1X is a port-based Network Access Control (NAC) standard. Before a device can access the network, it must authenticate through a RADIUS server.

## 802.1X Components
- **Supplicant**: Client device (PC, phone)
- **Authenticator**: Cisco switch or wireless AP
- **Authentication Server**: RADIUS server (Cisco ISE)

## How It Works
1. Device connects to switch port
2. Switch requests credentials (EAP)
3. Switch forwards to RADIUS server
4. RADIUS grants or denies access

## Switch Configuration
\`\`\`
SW1(config)# aaa new-model
SW1(config)# aaa authentication dot1x default group radius
SW1(config)# dot1x system-auth-control

! Configure RADIUS server
SW1(config)# radius-server host 192.168.1.200 key RadiusSecret

! Enable on interface
SW1(config)# interface fa0/1
SW1(config-if)# authentication port-control auto
SW1(config-if)# dot1x pae authenticator
\`\`\`

## Verify
\`\`\`
SW1# show dot1x all
SW1# show authentication sessions
\`\`\``,
  `## 802.1X چیست؟
802.1X یک استاندارد کنترل دسترسی به شبکه مبتنی بر پورت (NAC) است. قبل از اینکه یک دستگاه بتواند به شبکه دسترسی داشته باشد، باید از طریق یک سرور RADIUS احراز هویت شود.

## اجزای 802.1X
- **Supplicant**: دستگاه کلاینت (PC، تلفن)
- **Authenticator**: سوئیچ سیسکو یا AP بی‌سیم
- **Authentication Server**: سرور RADIUS (Cisco ISE)

## نحوه کار
1. دستگاه به پورت سوئیچ متصل می‌شود
2. سوئیچ اعتبارنامه‌ها را درخواست می‌کند (EAP)
3. سوئیچ به سرور RADIUS ارسال می‌کند
4. RADIUS دسترسی را اعطا یا رد می‌کند

## پیکربندی سوئیچ
\`\`\`
SW1(config)# aaa new-model
SW1(config)# aaa authentication dot1x default group radius
SW1(config)# dot1x system-auth-control

! پیکربندی سرور RADIUS
SW1(config)# radius-server host 192.168.1.200 key RadiusSecret

! فعال‌سازی روی اینترفیس
SW1(config)# interface fa0/1
SW1(config-if)# authentication port-control auto
SW1(config-if)# dot1x pae authenticator
SW1(config-if)# authentication event fail action authorize vlan 999  ! VLAN قرنطینه
\`\`\`

## بررسی
\`\`\`
SW1# show dot1x all
SW1# show authentication sessions
\`\`\``,
  'cisco-security', 12, 0)

post('cisco-security-best-practices',
  'Cisco Security Hardening — Best Practices Checklist',
  'سخت‌سازی سیسکو — چک‌لیست بهترین روش‌های امنیتی',
  'A comprehensive security hardening checklist for all Cisco devices.',
  'چک‌لیست جامع سخت‌سازی امنیتی برای همه دستگاه‌های سیسکو.',
  `## Security Hardening Checklist

### Authentication and Access
\`\`\`
! Strong enable password
enable secret <complex-password>

! Encrypt all passwords
service password-encryption

! Minimum password length
security passwords min-length 12

! Account lockout after failed attempts
login block-for 300 attempts 5 within 60

! Use local database
username admin privilege 15 secret <password>
line vty 0 15
 login local
 transport input ssh
 exec-timeout 10 0
\`\`\`

### Disable Unnecessary Services
\`\`\`
no service finger
no service tcp-small-servers
no service udp-small-servers
no ip http server        ! Disable HTTP management
no cdp run               ! If CDP not needed
no ip source-route
\`\`\`

### Logging
\`\`\`
logging buffered 65536 informational
logging host 192.168.1.100
service timestamps log datetime msec localtime show-timezone
\`\`\`

### Banner (Legal Notice)
\`\`\`
banner motd ^
WARNING: Unauthorized access is strictly prohibited.
All access is monitored and logged.
^
\`\`\`

### NTP (for accurate logs)
\`\`\`
ntp server 192.168.1.1
ntp authenticate
\`\`\``,
  `## چک‌لیست سخت‌سازی امنیتی

### احراز هویت و دسترسی
\`\`\`
! رمز عبور قوی
enable secret <رمز-پیچیده>

! رمزگذاری همه رمزها
service password-encryption

! حداقل طول رمز
security passwords min-length 12

! قفل شدن حساب پس از تلاش‌های ناموفق
login block-for 300 attempts 5 within 60

! استفاده از پایگاه داده محلی
username admin privilege 15 secret <رمز>
line vty 0 15
 login local
 transport input ssh
 exec-timeout 10 0
\`\`\`

### غیرفعال کردن سرویس‌های غیرضروری
\`\`\`
no service finger
no service tcp-small-servers
no service udp-small-servers
no ip http server           ! غیرفعال HTTP
no ip http secure-server    ! اگر نیاز نیست
no cdp run                  ! اگر CDP نیاز نیست
no ip source-route
no ip proxy-arp
\`\`\`

### لاگ‌گیری
\`\`\`
logging buffered 65536 informational
logging host 192.168.1.100
service timestamps log datetime msec localtime show-timezone
\`\`\`

### بنر قانونی
\`\`\`
banner motd ^
هشدار: دسترسی غیرمجاز کاملاً ممنوع است.
تمام دسترسی‌ها مانیتور و ثبت می‌شوند.
^
\`\`\`

### کنترل ترافیک مدیریتی
\`\`\`
! فقط از شبکه مدیریت SSH مجاز
ip access-list standard MGMT-ACCESS
 permit 192.168.100.0 0.0.0.255
 deny any log
line vty 0 15
 access-class MGMT-ACCESS in
\`\`\``,
  'cisco-security', 13, 0)

post('network-attacks-types',
  'Common Network Attacks and How to Defend Against Them',
  'حملات رایج شبکه و نحوه دفاع در برابر آنها',
  'Learn the most common network attacks targeting Cisco infrastructure and how to mitigate them.',
  'رایج‌ترین حملات شبکه که زیرساخت سیسکو را هدف قرار می‌دهند و نحوه کاهش آنها را بیاموزید.',
  `## Top Network Attacks

### 1. MAC Flooding
Flood switch with fake MACs → switch becomes a hub → attacker sees all traffic.
**Defense**: Port Security

### 2. VLAN Hopping
Switch Spoofing: attacker's port negotiates trunk → access to all VLANs.
**Defense**:
\`\`\`
SW1(config-if)# switchport mode access          ! Never use auto
SW1(config-if)# switchport nonegotiate
SW1(config)# vlan 999
SW1(config-vlan)# name UNUSED
SW1(config)# interface range fa0/24
SW1(config-if)# switchport access vlan 999
SW1(config-if)# shutdown
\`\`\`

### 3. ARP Spoofing/Poisoning
Fake ARP replies redirect traffic to attacker.
**Defense**: Dynamic ARP Inspection (DAI)

### 4. DHCP Starvation
Exhaust DHCP pool with fake requests.
**Defense**: DHCP Snooping + Rate Limiting

### 5. STP Manipulation
Attacker claims to be Root Bridge → controls traffic flow.
**Defense**:
\`\`\`
SW1(config-if)# spanning-tree bpduguard enable
SW1(config-if)# spanning-tree portfast
SW1(config)# spanning-tree portfast bpduguard default
\`\`\`

### 6. Password Attacks
Brute force against Telnet/SSH.
**Defense**: Login block, SSH only, strong passwords`,
  `## برترین حملات شبکه

### ۱. MAC Flooding (سیل MAC)
پر کردن سوئیچ با MAC‌های جعلی → سوئیچ مثل Hub می‌شود → مهاجم همه ترافیک را می‌بیند.
**دفاع**: Port Security

### ۲. VLAN Hopping (پرش VLAN)
جعل Switch: پورت مهاجم Trunk مذاکره می‌کند → دسترسی به همه VLANها.
**دفاع**:
\`\`\`
SW1(config-if)# switchport mode access     ! هرگز auto نگذارید
SW1(config-if)# switchport nonegotiate
\`\`\`

### ۳. ARP Spoofing/Poisoning
پاسخ‌های ARP جعلی ترافیک را به مهاجم هدایت می‌کند.
**دفاع**: Dynamic ARP Inspection

### ۴. DHCP Starvation (تخلیه DHCP)
پر کردن Pool DHCP با درخواست‌های جعلی.
**دفاع**: DHCP Snooping + Rate Limiting

### ۵. دستکاری STP
مهاجم ادعا می‌کند Root Bridge است → کنترل جریان ترافیک.
**دفاع**:
\`\`\`
SW1(config-if)# spanning-tree bpduguard enable
SW1(config-if)# spanning-tree portfast
SW1(config)# spanning-tree portfast bpduguard default
\`\`\`

### ۶. حملات رمز عبور
Brute force علیه Telnet/SSH.
**دفاع**: قفل ورود، فقط SSH، رمزهای قوی

### ۷. Rogue Access Point
AP غیرمجاز که کاربران را فریب می‌دهد.
**دفاع**: سیسکو WLC با RF Management`,
  'cisco-security', 13, 0)

console.log('✅ Section 2 done — 10 security posts inserted')

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — لاگ‌گیری و گزارش‌گیری (3 پست)
// ══════════════════════════════════════════════════════════════════════════════

post('syslog-cisco-config',
  'Syslog on Cisco — Centralized Logging Configuration',
  'Syslog در سیسکو — پیکربندی لاگ‌گیری متمرکز',
  'Configure Syslog on Cisco devices to collect all logs in one central place.',
  'Syslog را در دستگاه‌های سیسکو پیکربندی کنید تا همه لاگ‌ها در یک مکان مرکزی جمع‌آوری شوند.',
  `## What is Syslog?
Syslog is a standard protocol for sending log messages from network devices to a central logging server. It enables centralized monitoring of all events.

## Syslog Severity Levels
| Level | Name | Description |
|-------|------|-------------|
| 0 | Emergencies | System unusable |
| 1 | Alerts | Immediate action needed |
| 2 | Critical | Critical conditions |
| 3 | Errors | Error conditions |
| 4 | Warnings | Warning conditions |
| 5 | Notifications | Normal but significant |
| 6 | Informational | Informational messages |
| 7 | Debugging | Debug messages |

## Syslog Configuration
\`\`\`
R1(config)# logging on
R1(config)# logging host 192.168.1.100
R1(config)# logging trap informational     ! Level 6 and below
R1(config)# logging buffered 65536 debugging
R1(config)# service timestamps log datetime msec localtime show-timezone
R1(config)# logging source-interface loopback0
\`\`\`

## View Logs
\`\`\`
R1# show logging
R1# show logging | include ERROR
\`\`\`

## Common Syslog Servers
- **Cisco Prime Infrastructure**: Enterprise Cisco management
- **Graylog**: Open source
- **Splunk**: Enterprise SIEM
- **syslog-ng**: Linux-based`,
  `## Syslog چیست؟
Syslog یک پروتکل استاندارد برای ارسال پیام‌های لاگ از دستگاه‌های شبکه به یک سرور لاگ مرکزی است. امکان مانیتورینگ متمرکز همه رویدادها را فراهم می‌کند.

## سطوح Severity در Syslog
| سطح | نام | توضیح |
|-----|-----|-------|
| ۰ | Emergencies | سیستم غیرقابل استفاده |
| ۱ | Alerts | نیاز به اقدام فوری |
| ۲ | Critical | شرایط بحرانی |
| ۳ | Errors | شرایط خطا |
| ۴ | Warnings | شرایط هشدار |
| ۵ | Notifications | عادی اما مهم |
| ۶ | Informational | پیام‌های اطلاعاتی |
| ۷ | Debugging | پیام‌های دیباگ |

## پیکربندی Syslog
\`\`\`
R1(config)# logging on
R1(config)# logging host 192.168.1.100
R1(config)# logging trap informational     ! سطح ۶ و پایین‌تر
R1(config)# logging buffered 65536 debugging
R1(config)# service timestamps log datetime msec localtime show-timezone
R1(config)# logging source-interface loopback0
\`\`\`

## مشاهده لاگ‌ها
\`\`\`
R1# show logging                          ! همه لاگ‌ها
R1# show logging | include ERROR          ! فیلتر خطاها
R1# show logging | include OSPF           ! لاگ‌های OSPF
\`\`\`

## نکات مهم
- **لاگ‌ها UDP پورت 514 استفاده می‌کنند** — قابل اطمینان نیست
- سرور لاگ باید همیشه در دسترس باشد
- فضای ذخیره‌سازی کافی برای لاگ‌ها نگه دارید
- لاگ‌ها را به طور منظم بررسی و آرشیو کنید`,
  'cisco-logging', 10, 0)

post('snmp-monitoring-cisco',
  'SNMP — Network Monitoring with Cisco',
  'SNMP — مانیتورینگ شبکه با سیسکو',
  'Use SNMP to monitor Cisco devices with network management tools.',
  'از SNMP برای مانیتورینگ دستگاه‌های سیسکو با ابزارهای مدیریت شبکه استفاده کنید.',
  `## What is SNMP?
SNMP (Simple Network Management Protocol) allows network management tools to monitor and configure network devices remotely.

## SNMP Versions
| Version | Security | Recommendation |
|---------|----------|----------------|
| v1 | No encryption | Never use |
| v2c | Community string | Legacy only |
| v3 | Auth + Encryption | Always use |

## SNMP v3 Configuration (Recommended)
\`\`\`
! Create SNMP group with auth and encryption
R1(config)# snmp-server group MONITOR-GROUP v3 priv

! Create SNMP user
R1(config)# snmp-server user snmp-admin MONITOR-GROUP v3 
            auth sha AuthPassword123
            priv aes 128 PrivPassword456

! Enable SNMP traps
R1(config)# snmp-server host 192.168.1.200 version 3 priv snmp-admin
R1(config)# snmp-server enable traps

! Allow only management network
R1(config)# snmp-server community READONLY ro MGMT-ACL
\`\`\`

## Key MIBs to Monitor
- **ifInOctets/ifOutOctets**: Interface traffic
- **ifInErrors/ifOutErrors**: Interface errors
- **cpmCPUTotal5min**: CPU utilization
- **ciscoMemoryPool**: Memory usage

## Verify SNMP
\`\`\`
R1# show snmp
R1# show snmp user
\`\`\``,
  `## SNMP چیست؟
SNMP (پروتکل ساده مدیریت شبکه) به ابزارهای مدیریت شبکه اجازه می‌دهد دستگاه‌های شبکه را از راه دور مانیتور و پیکربندی کنند.

## نسخه‌های SNMP
| نسخه | امنیت | توصیه |
|------|-------|-------|
| v1 | بدون رمزگذاری | هرگز استفاده نکنید |
| v2c | رشته Community | فقط برای سیستم‌های قدیمی |
| v3 | احراز هویت + رمزگذاری | همیشه استفاده کنید |

## پیکربندی SNMP v3 (توصیه شده)
\`\`\`
! ایجاد گروه SNMP
R1(config)# snmp-server group MONITOR-GROUP v3 priv

! ایجاد کاربر SNMP
R1(config)# snmp-server user snmp-admin MONITOR-GROUP v3
            auth sha AuthPassword123
            priv aes 128 PrivPassword456

! فعال‌سازی تله‌های SNMP
R1(config)# snmp-server host 192.168.1.200 version 3 priv snmp-admin
R1(config)# snmp-server enable traps
R1(config)# snmp-server enable traps cpu threshold
R1(config)# snmp-server enable traps interface
\`\`\`

## شاخص‌های مهم برای مانیتورینگ
- **ifInOctets/ifOutOctets**: ترافیک اینترفیس
- **ifInErrors/ifOutErrors**: خطاهای اینترفیس
- **cpmCPUTotal5min**: مصرف CPU
- **ciscoMemoryPool**: مصرف حافظه

## ابزارهای مانیتورینگ SNMP
- PRTG Network Monitor
- SolarWinds NPM
- Zabbix
- Cacti (گراف‌های پهنای باند)`,
  'cisco-logging', 11, 0)

post('netflow-traffic-analysis',
  'NetFlow — Traffic Analysis and Reporting on Cisco',
  'NetFlow — تحلیل ترافیک و گزارش‌گیری در سیسکو',
  'NetFlow provides detailed traffic analysis — who is using bandwidth and how.',
  'NetFlow تحلیل ترافیک دقیق ارائه می‌دهد — چه کسی از پهنای باند استفاده می‌کند.',
  `## What is NetFlow?
NetFlow is a Cisco protocol that collects IP traffic statistics as it enters or exits an interface. It answers: who, what, when, where, and how much.

## NetFlow Data Collected
- Source and destination IP
- Source and destination ports
- Protocol (TCP/UDP/ICMP)
- Interface, timestamps
- Bytes and packets transferred

## NetFlow Configuration
\`\`\`
! Enable NetFlow on interfaces
R1(config)# interface gi0/0
R1(config-if)# ip flow ingress
R1(config-if)# ip flow egress

R1(config)# interface gi0/1
R1(config-if)# ip flow ingress

! Configure NetFlow export to collector
R1(config)# ip flow-export destination 192.168.1.150 9996
R1(config)# ip flow-export version 9
R1(config)# ip flow-export source gi0/1
R1(config)# ip flow-cache timeout active 1
R1(config)# ip flow-cache timeout inactive 15
\`\`\`

## Verify NetFlow
\`\`\`
R1# show ip flow export
R1# show ip cache flow
R1# show ip cache verbose flow
\`\`\`

## NetFlow Collectors
- Cisco Stealthwatch
- ntopng
- PRTG
- Elastiflow (ELK Stack)`,
  `## NetFlow چیست؟
NetFlow یک پروتکل سیسکو است که آمار ترافیک IP را هنگام ورود یا خروج از یک اینترفیس جمع‌آوری می‌کند. پاسخ می‌دهد: چه کسی، چه چیزی، کِی، کجا و چه مقدار.

## داده‌های جمع‌آوری شده توسط NetFlow
- IP منبع و مقصد
- پورت منبع و مقصد
- پروتکل (TCP/UDP/ICMP)
- اینترفیس، برچسب‌های زمانی
- بایت‌ها و پکت‌های انتقال یافته

## پیکربندی NetFlow
\`\`\`
! فعال‌سازی NetFlow روی اینترفیس‌ها
R1(config)# interface gi0/0
R1(config-if)# ip flow ingress
R1(config-if)# ip flow egress

R1(config)# interface gi0/1
R1(config-if)# ip flow ingress

! پیکربندی صادرات NetFlow به Collector
R1(config)# ip flow-export destination 192.168.1.150 9996
R1(config)# ip flow-export version 9
R1(config)# ip flow-export source gi0/1
R1(config)# ip flow-cache timeout active 1      ! دقیقه
R1(config)# ip flow-cache timeout inactive 15   ! ثانیه
\`\`\`

## بررسی NetFlow
\`\`\`
R1# show ip flow export              ! تنظیمات صادرات
R1# show ip cache flow               ! کش جریان‌ها
R1# show ip cache verbose flow       ! جزئیات بیشتر
\`\`\`

## کاربردهای واقعی NetFlow
- شناسایی کاربران پرمصرف پهنای باند
- تشخیص ترافیک مشکوک (DDoS، اسکن پورت)
- برنامه‌ریزی ظرفیت شبکه
- محاسبه هزینه‌های پهنای باند`,
  'cisco-logging', 11, 0)

console.log('✅ Section 3 done — 3 logging posts inserted')

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — مدل‌های سیسکو (3 پست)
// ══════════════════════════════════════════════════════════════════════════════

post('cisco-catalyst-switches',
  'Cisco Catalyst Switches — Complete Model Guide',
  'سوئیچ‌های Catalyst سیسکو — راهنمای کامل مدل‌ها',
  'Compare Cisco Catalyst switch models and find the right one for your network.',
  'مدل‌های سوئیچ Catalyst سیسکو را مقایسه کنید و مناسب‌ترین را برای شبکه خود بیابید.',
  `## Cisco Catalyst Switch Series

### Catalyst 1000 Series
- Entry-level for small businesses
- Fixed configuration, 8-48 ports
- Layer 2 only
- Fanless options for quiet environments

### Catalyst 2960-X/XR Series
- Small-medium business
- Layer 2 with limited L3 (IP routing)
- PoE+ support (up to 30W per port)
- FlexStack stacking (up to 8 switches)
- 10G uplinks

### Catalyst 3850/3650 Series (Classic)
- Mid-range enterprise
- Full Layer 3 routing
- StackWise-480 stacking
- Integrated wireless controller

### Catalyst 9000 Series (Current Gen)
- **9200**: SMB/Branch (replaces 2960)
- **9300**: Mid-range (replaces 3850)
- **9400**: Modular chassis
- **9500**: Core/aggregation
- **9600**: High-performance core
- All support: DNA Center, SD-Access, 802.11ax

## How to Choose?
| Need | Recommended |
|------|-------------|
| Small office | Catalyst 1000/9200 |
| Department switch | Catalyst 9300 |
| Campus core | Catalyst 9500/9600 |
| Data center | Nexus 93xx/95xx |`,
  `## سری سوئیچ‌های Catalyst سیسکو

### سری Catalyst 1000
- ابتدایی برای کسب‌وکارهای کوچک
- پیکربندی ثابت، ۸ تا ۴۸ پورت
- فقط لایه ۲
- گزینه‌های بدون فن برای محیط‌های ساکت

### سری Catalyst 2960-X/XR
- کسب‌وکارهای کوچک تا متوسط
- لایه ۲ با لایه ۳ محدود
- پشتیبانی PoE+ (تا ۳۰ وات هر پورت)
- استک FlexStack (تا ۸ سوئیچ)
- Uplink های 10G

### سری Catalyst 3850/3650 (کلاسیک)
- سطح متوسط سازمانی
- مسیریابی کامل لایه ۳
- استک StackWise-480
- کنترلر بی‌سیم یکپارچه

### سری Catalyst 9000 (نسل فعلی)
- **9200**: SMB/شعبه (جایگزین 2960)
- **9300**: سطح متوسط (جایگزین 3850)
- **9400**: شاسی ماژولار
- **9500**: هسته/تجمیع
- **9600**: هسته با کارایی بالا
- همه پشتیبانی می‌کنند: DNA Center، SD-Access، 802.11ax

## چگونه انتخاب کنیم؟
| نیاز | توصیه |
|------|-------|
| دفتر کوچک | Catalyst 1000/9200 |
| سوئیچ بخش | Catalyst 9300 |
| هسته Campus | Catalyst 9500/9600 |
| مرکز داده | Nexus 93xx/95xx |`,
  'cisco-models', 12, 0)

post('cisco-isr-routers',
  'Cisco ISR Routers — Models and Selection Guide',
  'روترهای ISR سیسکو — مدل‌ها و راهنمای انتخاب',
  'Guide to Cisco Integrated Services Router (ISR) models for branch and WAN connectivity.',
  'راهنمای مدل‌های روتر سرویس یکپارچه (ISR) سیسکو برای شعبه و اتصال WAN.',
  `## Cisco ISR Router Series

### ISR 900 Series
- Micro branch / SOHO
- ISR 921, 931, 951
- Up to 50 Mbps throughput
- Built-in DSL/LTE options

### ISR 1000 Series
- Small branch offices
- ISR 1100-4G, 1100-6G
- Up to 1 Gbps throughput
- LTE Advanced support
- Cisco DNA Center managed

### ISR 4000 Series (Current)
- **ISR 4221**: 35 Mbps, 2 WAN ports
- **ISR 4321**: 100 Mbps, 3 ports
- **ISR 4331**: 300 Mbps, expandable
- **ISR 4351**: 400 Mbps, 3 slots
- **ISR 4431**: 500 Mbps, 3 NIM slots
- **ISR 4451**: 1 Gbps, 4 NIM slots

### Key ISR Features
- Network Interface Modules (NIMs) for expansion
- Integrated voice (PVDM modules)
- Built-in encryption acceleration
- Application-aware networking
- DNA Center integration

## NIM Modules
| Module | Function |
|--------|----------|
| NIM-2T | 2 Serial WAN ports |
| NIM-4E/FE | 4 Ethernet ports |
| NIM-8CE1T1-PRI | T1/E1 for voice |
| NIM-4G-LTE | 4G/LTE WAN |`,
  `## سری روترهای ISR سیسکو

### سری ISR 900
- شعبه کوچک / SOHO
- ISR 921، 931، 951
- توان عملیاتی تا ۵۰ مگابیت
- گزینه‌های DSL/LTE داخلی

### سری ISR 1000
- دفاتر شعبه کوچک
- ISR 1100-4G، 1100-6G
- توان عملیاتی تا ۱ گیگابیت
- پشتیبانی LTE Advanced
- مدیریت توسط Cisco DNA Center

### سری ISR 4000 (فعلی)
- **ISR 4221**: 35 مگابیت، ۲ پورت WAN
- **ISR 4321**: 100 مگابیت، ۳ پورت
- **ISR 4331**: 300 مگابیت، قابل گسترش
- **ISR 4351**: 400 مگابیت، ۳ اسلات
- **ISR 4431**: 500 مگابیت، ۳ اسلات NIM
- **ISR 4451**: 1 گیگابیت، ۴ اسلات NIM

### ویژگی‌های کلیدی ISR
- ماژول‌های اینترفیس شبکه (NIM) برای گسترش
- صوت یکپارچه (ماژول‌های PVDM)
- شتاب‌دهی رمزگذاری داخلی
- شبکه‌یابی آگاه به اپلیکیشن
- یکپارچه‌سازی DNA Center

## چگونه انتخاب کنیم؟
| تعداد کاربر | توصیه |
|------------|-------|
| تا ۲۵ کاربر | ISR 900/1100 |
| ۲۵-۱۰۰ کاربر | ISR 4321/4331 |
| ۱۰۰-۵۰۰ کاربر | ISR 4351/4431 |
| بیش از ۵۰۰ کاربر | ISR 4451 یا ASR |`,
  'cisco-models', 12, 0)

post('cisco-asa-firepower-models',
  'Cisco ASA and Firepower — Firewall Models Explained',
  'ASA و Firepower سیسکو — مدل‌های فایروال توضیح داده شده',
  'Compare Cisco ASA and Firepower NGFW models to choose the right firewall.',
  'مدل‌های ASA و Firepower NGFW سیسکو را مقایسه کنید تا فایروال مناسب را انتخاب کنید.',
  `## Cisco Firewall Evolution

### Cisco ASA (Adaptive Security Appliance)
Traditional stateful firewall — still widely deployed.
- ASA 5505, 5506-X, 5508-X, 5516-X (Small/Branch)
- ASA 5525-X, 5545-X, 5555-X (Mid-range)
- ASA 5585-X (Enterprise)
- Firepower 1000, 2100, 4100, 9300 (New generation)

### Cisco Firepower NGFW
Next-Generation Firewall with:
- Application visibility and control (AVC)
- Next-Gen IPS (NGIPS)
- URL Filtering
- Advanced Malware Protection (AMP)
- Threat intelligence

## Firepower Models
| Model | Throughput | Use Case |
|-------|-----------|----------|
| FTD 1010 | 650 Mbps | Branch/SOHO |
| FTD 1120 | 1.5 Gbps | Small office |
| FTD 2110 | 2 Gbps | Mid-size |
| FTD 2140 | 8.5 Gbps | Enterprise |
| FTD 4115 | 20 Gbps | Large enterprise |
| FTD 9300 | 225 Gbps | Service provider |

## Management Options
- **FDM** (Firepower Device Manager): On-box, simple
- **FMC** (Firepower Management Center): Centralized, powerful
- **CDO** (Cisco Defense Orchestrator): Cloud-based`,
  `## تکامل فایروال سیسکو

### Cisco ASA (دستگاه امنیتی تطبیقی)
فایروال Stateful سنتی — هنوز به طور گسترده مستقر شده.
- ASA 5506-X، 5508-X، 5516-X (کوچک/شعبه)
- ASA 5525-X، 5545-X، 5555-X (سطح متوسط)
- ASA 5585-X (سازمانی)

### Cisco Firepower NGFW
فایروال نسل بعدی با:
- دید و کنترل اپلیکیشن (AVC)
- IPS نسل بعدی (NGIPS)
- فیلترینگ URL
- حفاظت در برابر بدافزار پیشرفته (AMP)
- اطلاعات تهدید

## مدل‌های Firepower
| مدل | توان عملیاتی | کاربرد |
|-----|-------------|--------|
| FTD 1010 | 650 مگابیت | شعبه/SOHO |
| FTD 1120 | 1.5 گیگابیت | دفتر کوچک |
| FTD 2110 | 2 گیگابیت | سطح متوسط |
| FTD 2140 | 8.5 گیگابیت | سازمانی |
| FTD 4115 | 20 گیگابیت | سازمان بزرگ |
| FTD 9300 | 225 گیگابیت | ارائه‌دهنده سرویس |

## گزینه‌های مدیریت
- **FDM**: مدیریت روی دستگاه، ساده
- **FMC**: مرکزی، قدرتمند
- **CDO**: مبتنی بر ابر`,
  'cisco-models', 11, 0)

console.log('✅ Section 4 done — 3 Cisco models posts inserted')

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — فایروال سیسکو (3 پست)
// ══════════════════════════════════════════════════════════════════════════════

post('cisco-asa-intro',
  'Cisco ASA Firewall — Introduction and Initial Setup',
  'فایروال ASA سیسکو — معرفی و راه‌اندازی اولیه',
  'Learn the basics of Cisco ASA firewall and how to perform initial configuration.',
  'مبانی فایروال ASA سیسکو را بیاموزید و نحوه انجام پیکربندی اولیه را یاد بگیرید.',
  `## What is Cisco ASA?
The Cisco ASA (Adaptive Security Appliance) is a stateful firewall that filters traffic based on state tables, not just ACLs. It tracks the state of connections to allow return traffic automatically.

## ASA Security Levels
- **Outside**: Level 0 (internet — least trusted)
- **Inside**: Level 100 (LAN — most trusted)
- **DMZ**: Level 50 (servers accessible from internet)

Traffic from higher to lower security level is allowed by default.

## Initial ASA Configuration
\`\`\`
ASA> enable
ASA# configure terminal
ASA(config)# hostname FW1
FW1(config)# enable password StrongPass123 encrypted

! Outside interface
FW1(config)# interface gi0/0
FW1(config-if)# nameif outside
FW1(config-if)# security-level 0
FW1(config-if)# ip address 203.0.113.1 255.255.255.252
FW1(config-if)# no shutdown

! Inside interface
FW1(config)# interface gi0/1
FW1(config-if)# nameif inside
FW1(config-if)# security-level 100
FW1(config-if)# ip address 192.168.1.1 255.255.255.0
FW1(config-if)# no shutdown

! DMZ interface
FW1(config)# interface gi0/2
FW1(config-if)# nameif dmz
FW1(config-if)# security-level 50
FW1(config-if)# ip address 10.0.1.1 255.255.255.0
FW1(config-if)# no shutdown
\`\`\`

## Default Route and NAT
\`\`\`
FW1(config)# route outside 0.0.0.0 0.0.0.0 203.0.113.2
FW1(config)# nat (inside,outside) dynamic interface
\`\`\``,
  `## ASA سیسکو چیست؟
ASA سیسکو (دستگاه امنیتی تطبیقی) یک فایروال Stateful است که ترافیک را بر اساس جداول وضعیت فیلتر می‌کند، نه فقط ACLها. وضعیت اتصالات را ردیابی می‌کند تا ترافیک بازگشتی را به طور خودکار مجاز کند.

## سطوح امنیتی ASA
- **Outside**: سطح ۰ (اینترنت — کمترین اعتماد)
- **Inside**: سطح ۱۰۰ (LAN — بیشترین اعتماد)
- **DMZ**: سطح ۵۰ (سرورهایی که از اینترنت قابل دسترس هستند)

ترافیک از سطح امنیتی بالاتر به پایین‌تر به طور پیش‌فرض مجاز است.

## پیکربندی اولیه ASA
\`\`\`
ASA> enable
ASA# configure terminal
ASA(config)# hostname FW1
FW1(config)# enable password StrongPass123 encrypted

! اینترفیس Outside (اینترنت)
FW1(config)# interface gi0/0
FW1(config-if)# nameif outside
FW1(config-if)# security-level 0
FW1(config-if)# ip address 203.0.113.1 255.255.255.252
FW1(config-if)# no shutdown

! اینترفیس Inside (LAN)
FW1(config)# interface gi0/1
FW1(config-if)# nameif inside
FW1(config-if)# security-level 100
FW1(config-if)# ip address 192.168.1.1 255.255.255.0
FW1(config-if)# no shutdown

! اینترفیس DMZ
FW1(config)# interface gi0/2
FW1(config-if)# nameif dmz
FW1(config-if)# security-level 50
FW1(config-if)# ip address 10.0.1.1 255.255.255.0
FW1(config-if)# no shutdown
\`\`\`

## مسیر پیش‌فرض و NAT
\`\`\`
FW1(config)# route outside 0.0.0.0 0.0.0.0 203.0.113.2
FW1(config)# nat (inside,outside) dynamic interface
\`\`\``,
  'cisco-firewall', 14, 1)

post('asa-access-rules',
  'Cisco ASA Access Rules and Object Groups',
  'قوانین دسترسی و گروه‌های Object در ASA سیسکو',
  'Learn to configure access rules and object groups on Cisco ASA to control traffic.',
  'قوانین دسترسی و گروه‌های Object را در ASA سیسکو برای کنترل ترافیک پیکربندی کنید.',
  `## Access Rules in ASA
ASA uses Access Control Entries (ACE) in Access Lists to filter traffic. Applied to interfaces with access-group.

## Object and Object Groups
Objects allow reuse of IP addresses, services, and networks.

\`\`\`
! Network Objects
FW1(config)# object network WEB-SERVER
FW1(config-network-object)# host 10.0.1.100

FW1(config)# object network INSIDE-NET
FW1(config-network-object)# subnet 192.168.1.0 255.255.255.0

! Service Objects
FW1(config)# object service HTTPS
FW1(config-service-object)# service tcp destination eq 443

! Object Groups
FW1(config)# object-group network INTERNAL-HOSTS
FW1(config-network-object-group)# network-object 192.168.1.0 255.255.255.0
FW1(config-network-object-group)# network-object 192.168.2.0 255.255.255.0
\`\`\`

## Access Lists with Objects
\`\`\`
! Allow HTTP/HTTPS from internet to DMZ web server
FW1(config)# access-list OUTSIDE-IN permit tcp any object WEB-SERVER eq 80
FW1(config)# access-list OUTSIDE-IN permit tcp any object WEB-SERVER eq 443

! Allow inside to access internet
FW1(config)# access-list INSIDE-OUT permit ip object INSIDE-NET any

! Apply to interfaces
FW1(config)# access-group OUTSIDE-IN in interface outside
FW1(config)# access-group INSIDE-OUT in interface inside
\`\`\`

## Verify
\`\`\`
FW1# show access-list
FW1# show conn
FW1# show xlate
\`\`\``,
  `## قوانین دسترسی در ASA
ASA از Access Control Entries (ACE) در لیست‌های دسترسی برای فیلتر کردن ترافیک استفاده می‌کند. با access-group به اینترفیس‌ها اعمال می‌شود.

## Object و Object Groups
Object ها امکان استفاده مجدد از آدرس‌های IP، سرویس‌ها و شبکه‌ها را می‌دهند.

\`\`\`
! Object های شبکه
FW1(config)# object network WEB-SERVER
FW1(config-network-object)# host 10.0.1.100

FW1(config)# object network INSIDE-NET
FW1(config-network-object)# subnet 192.168.1.0 255.255.255.0

! Object های سرویس
FW1(config)# object service HTTPS
FW1(config-service-object)# service tcp destination eq 443

! Object Groups
FW1(config)# object-group network INTERNAL-HOSTS
FW1(config-network-object-group)# network-object 192.168.1.0 255.255.255.0
FW1(config-network-object-group)# network-object 192.168.2.0 255.255.255.0
\`\`\`

## لیست‌های دسترسی با Object
\`\`\`
! مجاز کردن HTTP/HTTPS از اینترنت به سرور وب DMZ
FW1(config)# access-list OUTSIDE-IN permit tcp any object WEB-SERVER eq 80
FW1(config)# access-list OUTSIDE-IN permit tcp any object WEB-SERVER eq 443

! مجاز کردن داخل برای دسترسی به اینترنت
FW1(config)# access-list INSIDE-OUT permit ip object INSIDE-NET any

! اعمال به اینترفیس‌ها
FW1(config)# access-group OUTSIDE-IN in interface outside
FW1(config)# access-group INSIDE-OUT in interface inside
\`\`\`

## بررسی
\`\`\`
FW1# show access-list          ! قوانین دسترسی
FW1# show conn                 ! اتصالات فعال
FW1# show xlate                ! جدول NAT
FW1# show service-policy       ! سیاست‌های سرویس
\`\`\``,
  'cisco-firewall', 13, 0)

post('cisco-firepower-ngfw',
  'Cisco Firepower NGFW — Next-Generation Firewall Features',
  'Firepower NGFW سیسکو — ویژگی‌های فایروال نسل بعدی',
  'Explore Cisco Firepower NGFW features that go beyond traditional firewalls.',
  'ویژگی‌های Firepower NGFW سیسکو را که فراتر از فایروال‌های سنتی هستند کشف کنید.',
  `## What Makes NGFW Different?
Traditional firewalls filter by IP and port. NGFW goes further:
- See applications (not just ports)
- Identify users (not just IPs)
- Detect and block malware inline
- Decrypt and inspect SSL traffic

## Cisco Firepower Key Features

### 1. Application Visibility and Control (AVC)
Block or limit specific applications:
- Block Facebook, TikTok
- Limit YouTube bandwidth
- Allow only business apps

### 2. URL Filtering
Block websites by category:
- Block gambling, adult content
- Block malware-hosting sites
- Custom block lists

### 3. Intrusion Prevention (NGIPS)
- Signature-based detection (40,000+ rules)
- Snort 3 engine
- Automatic rule updates from Cisco Talos

### 4. Advanced Malware Protection (AMP)
- File reputation (SHA256 hash check)
- Dynamic malware analysis (sandboxing)
- Retrospective detection (catch malware days later)

### 5. SSL Decryption
Inspect encrypted HTTPS traffic — most malware uses HTTPS.

## Management — Cisco FMC
\`\`\`
Policies → Access Control → Add Rule
- Source: any
- Destination: any
- Application: Facebook
- Action: Block
\`\`\``,
  `## NGFW چه چیزی متفاوتی دارد؟
فایروال‌های سنتی بر اساس IP و پورت فیلتر می‌کنند. NGFW بیشتر می‌رود:
- مشاهده اپلیکیشن‌ها (نه فقط پورت‌ها)
- شناسایی کاربران (نه فقط IP)
- تشخیص و مسدود کردن بدافزار به صورت Inline
- رمزگشایی و بازرسی ترافیک SSL

## ویژگی‌های کلیدی Firepower

### ۱. دید و کنترل اپلیکیشن (AVC)
مسدود کردن یا محدود کردن اپلیکیشن‌های خاص:
- مسدود کردن فیسبوک، تیک‌تاک
- محدود کردن پهنای باند یوتیوب
- مجاز کردن فقط اپ‌های تجاری

### ۲. فیلترینگ URL
مسدود کردن وب‌سایت‌ها بر اساس دسته‌بندی:
- مسدود کردن قمار، محتوای بزرگسال
- مسدود کردن سایت‌های حاوی بدافزار
- لیست‌های مسدودسازی سفارشی

### ۳. جلوگیری از نفوذ (NGIPS)
- تشخیص مبتنی بر امضا (بیش از ۴۰,۰۰۰ قانون)
- موتور Snort 3
- بروزرسانی خودکار قوانین از Cisco Talos

### ۴. حفاظت پیشرفته در برابر بدافزار (AMP)
- اعتبارسنجی فایل (بررسی هش SHA256)
- تحلیل پویا بدافزار (Sandboxing)
- تشخیص گذشته‌نگر (کشف بدافزار روزها بعد)

### ۵. رمزگشایی SSL
بازرسی ترافیک HTTPS رمزگذاری شده — اکثر بدافزارها از HTTPS استفاده می‌کنند.`,
  'cisco-firewall', 13, 0)

console.log('✅ Section 5 done — 3 firewall posts inserted')

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — تنظیمات ضروری (3 پست)
// ══════════════════════════════════════════════════════════════════════════════

post('cisco-initial-required-config',
  'Essential First-Time Configuration for Any Cisco Device',
  'تنظیمات ضروری اولیه برای هر دستگاه سیسکو',
  'A complete checklist of must-do configurations before deploying any Cisco device.',
  'چک‌لیست کامل تنظیماتی که قبل از راه‌اندازی هر دستگاه سیسکو باید انجام دهید.',
  `## Pre-Deployment Checklist

### 1. Basic Identity
\`\`\`
hostname DEVICE-NAME
ip domain-name company.local
\`\`\`

### 2. Secure Management Access
\`\`\`
enable secret <strong-password>
service password-encryption
security passwords min-length 12
username admin privilege 15 secret <password>

crypto key generate rsa modulus 2048
ip ssh version 2

line console 0
 login local
 exec-timeout 5 0
line vty 0 15
 login local
 transport input ssh
 exec-timeout 10 0
\`\`\`

### 3. Time Synchronization
\`\`\`
ntp server 0.pool.ntp.org
ntp server 1.pool.ntp.org
service timestamps log datetime msec localtime
service timestamps debug datetime msec localtime
clock timezone IRST 3 30
\`\`\`

### 4. Logging
\`\`\`
logging buffered 65536
logging host 192.168.100.10
logging trap informational
\`\`\`

### 5. Disable Unused Services
\`\`\`
no service tcp-small-servers
no service udp-small-servers
no ip http server
no cdp run
no ip source-route
\`\`\`

### 6. Login Protection
\`\`\`
login block-for 300 attempts 5 within 60
login on-failure log
login on-success log
\`\`\`

### 7. Save Configuration
\`\`\`
write memory
\`\`\``,
  `## چک‌لیست قبل از راه‌اندازی

### ۱. هویت پایه
\`\`\`
hostname DEVICE-NAME
ip domain-name company.local
\`\`\`

### ۲. دسترسی مدیریت امن
\`\`\`
enable secret <رمز-قوی>
service password-encryption
security passwords min-length 12
username admin privilege 15 secret <رمز>

crypto key generate rsa modulus 2048
ip ssh version 2

line console 0
 login local
 exec-timeout 5 0
line vty 0 15
 login local
 transport input ssh
 exec-timeout 10 0
\`\`\`

### ۳. همگام‌سازی زمان
\`\`\`
ntp server 0.pool.ntp.org
ntp server 1.pool.ntp.org
service timestamps log datetime msec localtime
clock timezone IRST 3 30
\`\`\`

### ۴. لاگ‌گیری
\`\`\`
logging buffered 65536
logging host 192.168.100.10
logging trap informational
\`\`\`

### ۵. غیرفعال کردن سرویس‌های غیرضروری
\`\`\`
no service tcp-small-servers
no service udp-small-servers
no ip http server
no cdp run
no ip source-route
\`\`\`

### ۶. حفاظت از ورود
\`\`\`
login block-for 300 attempts 5 within 60
login on-failure log
login on-success log
\`\`\`

### ۷. ذخیره پیکربندی
\`\`\`
write memory
\`\`\`

### ۸. مستندسازی
- IP آدرس‌ها، نقش دستگاه، تاریخ نصب
- رمزها را در جای امن نگهداری کنید (نه در فایل متنی)`,
  'cisco-config', 12, 0)

post('cisco-password-security',
  'Cisco Password and Authentication Security — Complete Guide',
  'امنیت رمز عبور و احراز هویت سیسکو — راهنمای کامل',
  'Secure all authentication methods on Cisco devices — from console to privilege levels.',
  'همه روش‌های احراز هویت دستگاه‌های سیسکو را ایمن کنید.',
  `## Password Types in Cisco

### Enable Password vs Enable Secret
\`\`\`
! NEVER use this — stored as plaintext:
enable password oldway

! Always use this — stored as SHA-256:
enable secret StrongPassword123!
\`\`\`

### Console Line Security
\`\`\`
line console 0
 login local                 ! Use local username database
 exec-timeout 5 0            ! Logout after 5 minutes
 logging synchronous         ! Fix log message interruptions
\`\`\`

### VTY (SSH) Line Security
\`\`\`
line vty 0 15
 login local
 transport input ssh          ! SSH only, no Telnet
 exec-timeout 10 0
 access-class MGMT-ACCESS in  ! Restrict source IPs
\`\`\`

### Privilege Levels
\`\`\`
! Level 1 = user EXEC (default)
! Level 15 = full access (default)
! Create custom level for help desk
username helpdesk privilege 7 secret HelpDeskPass
privilege exec level 7 show running-config
privilege exec level 7 show ip route
\`\`\`

### Password Encryption
\`\`\`
service password-encryption   ! Encrypts Type 7 (weak, use secret instead)
security passwords min-length 12
\`\`\`

### AAA with RADIUS
\`\`\`
aaa new-model
aaa authentication login default group radius local
aaa authorization exec default group radius local
radius-server host 192.168.1.200 key SecretKey
\`\`\``,
  `## انواع رمز عبور در سیسکو

### Enable Password در مقابل Enable Secret
\`\`\`
! هرگز از این استفاده نکنید — به صورت متن ساده ذخیره می‌شود:
enable password oldway

! همیشه از این استفاده کنید — به صورت SHA-256 ذخیره می‌شود:
enable secret StrongPassword123!
\`\`\`

### امنیت خط Console
\`\`\`
line console 0
 login local                 ! استفاده از پایگاه داده کاربر محلی
 exec-timeout 5 0            ! خروج بعد از ۵ دقیقه
 logging synchronous         ! رفع قطع شدن پیام لاگ
\`\`\`

### امنیت خط VTY (SSH)
\`\`\`
line vty 0 15
 login local
 transport input ssh          ! فقط SSH، بدون Telnet
 exec-timeout 10 0
 access-class MGMT-ACCESS in  ! محدود کردن IP‌های منبع
\`\`\`

### سطوح Privilege
\`\`\`
! سطح ۱ = User EXEC (پیش‌فرض)
! سطح ۱۵ = دسترسی کامل (پیش‌فرض)
! ایجاد سطح سفارشی برای Help Desk
username helpdesk privilege 7 secret HelpDeskPass
privilege exec level 7 show running-config
privilege exec level 7 show ip route
\`\`\`

### رمزگذاری رمز عبور
\`\`\`
service password-encryption        ! رمزگذاری Type 7 (ضعیف)
security passwords min-length 12   ! حداقل ۱۲ کاراکتر
\`\`\`

### جدول انواع رمزگذاری
| نوع | الگوریتم | امنیت |
|-----|----------|-------|
| Type 0 | بدون رمزگذاری | هرگز استفاده نکنید |
| Type 7 | Vigenere | ضعیف - به راحتی شکسته می‌شود |
| Type 5 | MD5 | قابل قبول |
| Type 8 | PBKDF2 | قوی |
| Type 9 | Scrypt | بهترین |`,
  'cisco-config', 11, 0)

post('cisco-backup-restore',
  'Cisco Configuration Backup and Restore — Best Practices',
  'پشتیبان‌گیری و بازیابی پیکربندی سیسکو — بهترین روش‌ها',
  'Learn how to backup Cisco configurations and restore them when needed.',
  'نحوه پشتیبان‌گیری از پیکربندی سیسکو و بازیابی آنها در صورت نیاز را یاد بگیرید.',
  `## Why Backup?
Hardware failures, misconfigurations, or ransomware can destroy your network. A recent backup means recovery in minutes instead of days.

## Backup Methods

### 1. Copy to TFTP Server
\`\`\`
R1# copy running-config tftp
Address or name of remote host? 192.168.1.200
Destination filename? R1-backup-2025.cfg
\`\`\`

### 2. Copy to USB
\`\`\`
R1# copy running-config usbflash0:R1-backup.cfg
\`\`\`

### 3. Copy to FTP
\`\`\`
R1(config)# ip ftp username cisco
R1(config)# ip ftp password ftppass
R1# copy running-config ftp://192.168.1.200/R1-backup.cfg
\`\`\`

### 4. Automated with EEM
\`\`\`
R1(config)# event manager applet BACKUP-CONFIG
R1(config-applet)# event timer cron cron-entry "0 2 * * 0"
R1(config-applet)# action 1.0 cli command "enable"
R1(config-applet)# action 2.0 cli command "copy run tftp://192.168.1.200/R1-weekly.cfg"
\`\`\`

## Restore Configuration
\`\`\`
R1# copy tftp running-config
Address or name of remote host? 192.168.1.200
Source filename? R1-backup-2025.cfg

! Merge only (doesn't remove existing config)
! For clean restore:
R1# write erase
R1# reload
! Then copy from TFTP
\`\`\`

## IOS Upgrade with Rollback
\`\`\`
R1# configure replace tftp://192.168.1.200/R1-backup.cfg
\`\`\``,
  `## چرا پشتیبان‌گیری؟
خرابی سخت‌افزار، پیکربندی اشتباه یا باج‌افزار می‌توانند شبکه شما را نابود کنند. یک پشتیبان اخیر یعنی بازیابی در دقایق به جای روزها.

## روش‌های پشتیبان‌گیری

### ۱. کپی به سرور TFTP
\`\`\`
R1# copy running-config tftp
Address or name of remote host? 192.168.1.200
Destination filename? R1-backup-2025.cfg
\`\`\`

### ۲. کپی به USB
\`\`\`
R1# copy running-config usbflash0:R1-backup.cfg
\`\`\`

### ۳. پشتیبان‌گیری خودکار با EEM
\`\`\`
R1(config)# event manager applet BACKUP-CONFIG
R1(config-applet)# event timer cron cron-entry "0 2 * * 0"
R1(config-applet)# action 1.0 cli command "enable"
R1(config-applet)# action 2.0 cli command "copy run tftp://192.168.1.200/R1-weekly.cfg"
\`\`\`

## بازیابی پیکربندی
\`\`\`
R1# copy tftp running-config
Address or name of remote host? 192.168.1.200
Source filename? R1-backup-2025.cfg
\`\`\`

## پاکسازی و بازیابی کامل
\`\`\`
R1# write erase          ! پاک کردن NVRAM
R1# reload               ! راه‌اندازی مجدد
! بعد از بوت، پیکربندی را از TFTP بارگذاری کنید
\`\`\`

## برنامه پشتیبان‌گیری توصیه شده
| فرکانس | روش | نگهداری |
|--------|-----|---------|
| روزانه | TFTP خودکار | ۱ هفته |
| هفتگی | USB یا FTP | ۱ ماه |
| قبل از هر تغییر | دستی | تا تغییر بعدی |
| پس از تغییر موفق | TFTP | دائمی |`,
  'cisco-config', 11, 0)

console.log('✅ Section 6 done — 3 config posts inserted')
console.log('')
console.log('🎉 All blog posts inserted successfully!')
console.log('Total posts: 20 + 10 + 3 + 3 + 3 + 3 = 42 posts')
