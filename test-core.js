const fs = require('fs');
const path = 'D:/WorkBuddyAI/2026-10-22-10-52-00/ip-batch/index.html';
const html = fs.readFileSync(path, 'utf8');
const m = html.match(/\/\* ==================== CORE START[\s\S]*?\*\/([\s\S]*?)\/\* ==================== CORE END/);
if (!m) { console.error('CORE 区块未找到'); process.exit(1); }
const code = m[1];
const api = new Function(code + '\nreturn {stripPort,parseIPv4,isIPv6,normIPv6,ipv6ToBigInt,bigIntToIPv6,parseList,expandCidr,normalizeZxinc,normalizeWhois,normalizeIpsb,normalizeIpinfo,netOf,toCSV,normDomain,isDomain,parseList_Domain,rdapBaseFor,parseVCard,normalizeRdap,normalizeDoh,daysLeft};')();

let pass = 0, fail = 0;
function eq(name, got, want) {
  const rep = (k, v) => (typeof v === 'bigint' ? v.toString() : v);
  const g = JSON.stringify(got, rep), w = JSON.stringify(want, rep);
  if (g === w) { pass++; } else { fail++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
}
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')); } }

// ---- IPv4 ----
eq('v4 parse', api.parseIPv4('1.2.3.4'), '16909060');
eq('v4 bad 256', api.parseIPv4('1.2.3.256'), null);
eq('v4 bad 3 parts', api.parseIPv4('1.2.3'), null);
eq('v4 leading zero', api.parseIPv4('01.2.3.4'), '16909060');

// ---- IPv6 ----
eq('v6 ::1', api.ipv6ToBigInt('::1'), '1');
eq('v6 full', api.ipv6ToBigInt('2408:8000:0000:0000:0000:0000:0000:0001'), String(0x24088000000000000000000000000001n));
eq('v6 compress', api.ipv6ToBigInt('2408:8000::1'), String(0x24088000000000000000000000000001n));
eq('v6 v4mapped', api.ipv6ToBigInt('::ffff:1.2.3.4'), String(0xffff01020304n));
eq('v6 bad double ::', api.ipv6ToBigInt('1::2::3'), null);
eq('v6 bad group', api.ipv6ToBigInt('12345::1'), null);
eq('v6 9 groups', api.ipv6ToBigInt('1:2:3:4:5:6:7:8:9'), null);
eq('v6 :: ', api.ipv6ToBigInt('::'), '0');
eq('v6 tail :', api.ipv6ToBigInt('1:2:3:4:5:6:7:'), null);

eq('norm v6', api.normIPv6('2408:8000:0:0:0:0:0:1'), '2408:8000::1');
eq('norm v6 upper', api.normIPv6('2408:8000::1'), '2408:8000::1');

eq('bigint -> ::1', api.bigIntToIPv6(1n), '::1');
eq('bigint -> ::', api.bigIntToIPv6(0n), '::');
eq('bigint roundtrip', api.bigIntToIPv6(0x24088000000000000000000000000001n), '2408:8000::1');
eq('bigint all ffff', api.bigIntToIPv6((1n<<128n)-1n), 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');

// ---- stripPort ----
eq('port v4', api.stripPort('1.2.3.4:8080'), '1.2.3.4');
eq('port v6 bracket', api.stripPort('[2408:8000::1]:443'), '2408:8000::1');
eq('no port', api.stripPort('1.2.3.4'), '1.2.3.4');

// ---- parseList ----
let r = api.parseList('1.1.1.1\n8.8.8.8, 2408:8000::1  114.114.114.114\n#注释\nbad-ip\n1.1.1.1');
eq('parseList valid count', r.valid.length, 4);
eq('parseList dedupe', r.valid.filter(x=>x.ip==='1.1.1.1').length, 1);
eq('parseList invalid', r.invalid.map(x=>x.raw), ['bad-ip']);
eq('parseList ver', r.valid.map(x=>x.ver), ['IPv4','IPv4','IPv6','IPv4']);

r = api.parseList('2408:8000:0:0::0001');
eq('parseList norm ipv6', r.valid[0].ip, '2408:8000::1');

r = api.parseList('[2001:4860:4860::8888]:443');
eq('parseList bracket', r.valid[0].ip, '2001:4860:4860::8888');

// ---- CIDR ----
r = api.parseList('1.2.3.0/30');
eq('cidr v4 /30', r.valid.map(x=>x.ip), ['1.2.3.0','1.2.3.1','1.2.3.2','1.2.3.3']);
r = api.parseList('192.168.1.77/32');
eq('cidr v4 /32', r.valid.map(x=>x.ip), ['192.168.1.77']);
r = api.parseList('10.0.0.0/8');
eq('cidr v4 too big', r.invalid.length, 1);
r = api.parseList('2408:8000::/126');
eq('cidr v6 /126', r.valid.map(x=>x.ip), ['2408:8000::','2408:8000::1','2408:8000::2','2408:8000::3']);
r = api.parseList('2408:8000::/64');
eq('cidr v6 too big', r.invalid.length, 1);
r = api.parseList('1.2.3.0/30', { expandCidr: false });
eq('cidr disabled', r.invalid[0].reason, 'CIDR 已关闭展开');

// ---- netOf ----
eq('net v4', api.netOf('1.2.3.4','IPv4'), '1.2.3.0/24');
eq('net v6', api.netOf('2408:8000:1234:5678::1','IPv6'), '2408:8000:1234:5678::/64');

// ---- normalize ----
let z = api.normalizeZxinc({code:0,data:{location:'美国–加利福尼亚州–圣克拉拉–山景城 谷歌公司DNS服务器',country:'美国–加利福尼亚州–圣克拉拉–山景城',local:'谷歌公司DNS服务器'}});
eq('zxinc country', z.country, '美国');
eq('zxinc region', z.region, '加利福尼亚州');
eq('zxinc city', z.city, '圣克拉拉');
eq('zxinc isp', z.isp, '谷歌公司DNS服务器');

z = api.normalizeZxinc({code:0,data:{location:'中国–山西 联通',country:'中国–山西',local:'联通'}});
eq('zxinc cn', [z.country,z.region,z.city,z.isp], ['中国','山西','','联通']);

// IPv6 记录里 country 含制表符/多空格的情况
z = api.normalizeZxinc({code:0,data:{location:'中国\t北京市\t\t北京市 中国电信\t城域网',country:'中国\t北京市\t\t北京市',local:'中国电信\t城域网'}});
eq('zxinc tab', [z.country,z.region,z.city,z.isp], ['中国','北京市','北京市','中国电信 城域网']);

z = api.normalizeZxinc({code:0,data:{location:'全球任播地址 Google Inc\t服务器网段 (Anycast)',country:'全球任播地址',local:'Google Inc\t服务器网段 (Anycast)'}});
eq('zxinc anycast', [z.country,z.region,z.city,z.isp], ['全球任播地址','','','Google Inc 服务器网段 (Anycast)']);

z = api.normalizeZxinc({code:0,data:{location:'中国 中国联通\t169骨干网',country:'中国',local:'中国联通\t169骨干网'}});
eq('zxinc ipv6 no province', [z.country,z.region,z.city,z.isp], ['中国','','','中国联通 169骨干网']);

let w = api.normalizeWhois({success:true,country:'China',region:'Beijing',city:'Beijing',connection:{isp:'China Unicom',org:'CHINA UNICOM'}});
eq('whois', [w.country,w.region,w.city,w.isp], ['China','Beijing','Beijing','China Unicom']);

let s = api.normalizeIpsb({ip:'1.1.1.1',country:'China',region:'Beijing',city:'X',isp:'',organization:'CF',asn_organization:'AS13335'});
eq('ipsb fallback isp', s.isp, 'CF');

let info = api.normalizeIpinfo({ip:'1.1.1.1',country:'AU',region:'Queensland',city:'Brisbane',org:'AS13335 Cloudflare'});
eq('ipinfo', [info.country, info.isp], ['AU','AS13335 Cloudflare']);

// 异常抛出
try { api.normalizeZxinc({code:1}); fail++; console.log('FAIL zxinc err not thrown'); } catch(e){ pass++; }
try { api.normalizeZxinc({code:0,data:{location:'',country:'',local:''}}); fail++; console.log('FAIL zxinc empty not thrown'); } catch(e){ pass++; }
try { api.normalizeWhois({success:false,message:'reserved range'}); fail++; console.log('FAIL whois err not thrown'); } catch(e){ pass++; }

// ---- CSV ----
const csv = api.toCSV([{ip:'1.1.1.1',ver:'IPv4',country:'美国',region:'',city:'',isp:'a,b',full:'说"引号"',source:'纯真',status:'ok'}]);
ok('csv header', csv.split('\r\n')[0].startsWith('序号,IP,版本'));
ok('csv escape', csv.indexOf('"a,b"') > -1 && csv.indexOf('"说""引号"""') > -1, csv);

/* ==================== 域名 / RDAP ==================== */

// ---- normDomain ----
eq('域名 去协议路径', api.normDomain('https://GitHub.com/foo/bar?x=1#y'), 'github.com');
eq('域名 去端口', api.normDomain('github.com:443'), 'github.com');
eq('域名 去末尾点', api.normDomain('github.com.'), 'github.com');
eq('域名 大写', api.normDomain('GITHUB.COM'), 'github.com');
eq('中文域名转 punycode', api.normDomain('中文.com'), 'xn--fiq228c.com');

// ---- isDomain ----
ok('合法域名', api.isDomain('github.com'));
ok('子域名', api.isDomain('api.github.com'));
ok('连字符域名', api.isDomain('my-site.co'));
ok('拒绝纯 IP', !api.isDomain('1.1.1.1'));
ok('拒绝 IPv6', !api.isDomain('2408:8000::1'));
ok('拒绝单段', !api.isDomain('localhost'));
ok('拒绝单字母 TLD', !api.isDomain('a.b'));
ok('拒绝非法字符', !api.isDomain('bad_domain.com'));
ok('拒绝空', !api.isDomain(''));
ok('接受中文域名', api.isDomain('中文.com'));

// ---- parseList_Domain ----
let dl = api.parseList_Domain('GitHub.com\nhttps://baidu.com/x\n, example.org ;github.com\n#注释\n1.1.1.1\nbad_domain');
eq('域名列表 有效数', dl.valid, ['github.com','baidu.com','example.org']);
eq('域名列表 无效项', dl.invalid.map(x=>x.raw), ['1.1.1.1','bad_domain']);

// ---- rdapBaseFor ----
eq('rdap .com', api.rdapBaseFor('github.com'), 'https://rdap.verisign.com/com/v1/');
eq('rdap .org', api.rdapBaseFor('example.org'), 'https://rdap.publicinterestregistry.org/rdap/');
eq('rdap .cn 无', api.rdapBaseFor('baidu.cn'), null);
eq('rdap 未知后缀走 rdap.org', api.rdapBaseFor('foo.zzz'), 'https://rdap.org/');

// ---- parseVCard ----
const vc = api.parseVCard({vcardArray:['vcard',[['version',{},'text','4.0'],['fn',{},'text','MarkMonitor Inc.'],['email',{},'text','abuse@x.com']]]});
eq('vcard fn', vc.fn, 'MarkMonitor Inc.');
eq('vcard email', vc.email, 'abuse@x.com');
eq('vcard 空', api.parseVCard(null), {});

// ---- normalizeRdap（贴近真实结构）----
const rdapRaw = {
  objectClassName:'domain', ldhName:'GITHUB.COM',
  status:['client delete prohibited','client transfer prohibited'],
  events:[{eventAction:'registration',eventDate:'2007-10-09T18:20:50Z'},
          {eventAction:'expiration',eventDate:'2028-10-09T18:20:50Z'},
          {eventAction:'last changed',eventDate:'2026-09-07T09:12:31Z'},
          {eventAction:'last update of RDAP database',eventDate:'2026-10-22T00:00:00Z'}],
  entities:[{roles:['registrar'], vcardArray:['vcard',[['fn',{},'text','MarkMonitor Inc.']]],
             entities:[{roles:['abuse'], vcardArray:['vcard',[['fn',{},'text','Abuse Desk']]]}]},
            {roles:['registrant'], vcardArray:['vcard',[['fn',{},'text','GitHub, Inc.']]]}],
  nameservers:[{ldhName:'DNS1.P08.NSONE.NET'},{ldhName:'DNS2.P08.NSONE.NET'}]
};
const wr = api.normalizeRdap(rdapRaw);
eq('rdap 域名', wr.domain, 'github.com');
eq('rdap 注册商', wr.registrar, 'MarkMonitor Inc.');
eq('rdap 注册人', wr.registrant, 'GitHub, Inc.');
eq('rdap 滥用举报', wr.abuse, 'Abuse Desk');
eq('rdap 注册时间', wr.created, '2007-10-09');
eq('rdap 到期时间', wr.expires, '2028-10-09');
eq('rdap 更新时间（不取库更新时间）', wr.updated, '2026-09-07');
eq('rdap NS', wr.ns, ['dns1.p08.nsone.net','dns2.p08.nsone.net']);
eq('rdap status', wr.status, 'client delete prohibited, client transfer prohibited');

try { api.normalizeRdap({errorCode:404,title:'No RDAP service is available for this resource'}); fail++; console.log('FAIL rdap 404 未抛错'); } catch(e){ ok('rdap 404 抛错', e.message.indexOf('No RDAP') >= 0); }
try { api.normalizeRdap(null); fail++; console.log('FAIL rdap null 未抛错'); } catch(e){ pass++; }

// ---- normalizeDoh ----
const doh = api.normalizeDoh({Status:0, Answer:[
  {name:'github.com.', type:5, TTL:60, data:'github.com.cdn.cloudflare.net.'},
  {name:'github.com.', type:1, TTL:60, data:'20.205.243.166'},
  {name:'github.com.', type:1, TTL:60, data:'20.27.177.113'},
  {name:'github.com.', type:28, TTL:60, data:'2606:50c0:8000::154'}
]});
eq('doh A', doh.a, ['20.205.243.166','20.27.177.113']);
eq('doh AAAA', doh.aaaa, ['2606:50c0:8000::154']);
eq('doh CNAME 去尾点', doh.cname, ['github.com.cdn.cloudflare.net']);
eq('doh status', doh.status, 0);
eq('doh NXDOMAIN', api.normalizeDoh({Status:3}).status, 3);
eq('doh 空', api.normalizeDoh(null).a, []);

// ---- daysLeft ----
const NOW = Date.parse('2026-10-22T00:00:00Z');
eq('剩余天数', api.daysLeft('2028-10-09', NOW), 718);
eq('已过期', api.daysLeft('2020-01-01', NOW) < 0, true);
eq('空日期', api.daysLeft('', NOW), null);
eq('非法日期', api.daysLeft('not-a-date', NOW), null);

console.log(`\n通过 ${pass} / ${pass+fail}`);
process.exit(fail ? 1 : 0);
