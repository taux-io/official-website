#!/usr/bin/env python3
"""Google Search Console for taux.io: what Google has indexed and how people find it.

Read-only. The token's scope is webmasters.readonly, so this can look but not submit a sitemap or
ask for re-indexing; doing either needs a new consent with a wider scope.

Credentials live OUTSIDE the repo, in ~/.config/taux-gsc/ (override with GSC_DIR):
  client_secret.json   the OAuth client from the Google Cloud project (a secret; never commit it)
  token.json           written by the first consent; holds a refresh token, so it renews itself
  venv/                a virtualenv with google-api-python-client

This script only reads that directory. The token belongs to a Google account, not to this repo: never
copy token.json into a repo, and if another tool needs it, point GSC_DIR at the same directory.

Setting it up on a new machine:
  1. An owner of the property adds your Google account as a user of sc-domain:taux.io in Search Console.
  2. A Google Cloud project with the Search Console API enabled, and an OAuth client of type "Desktop app".
     Put its client_secret.json in ~/.config/taux-gsc/. While the app is in testing mode the OAuth consent
     screen must list your account as a test user (not verified here; check it in the Cloud console).
  3. python3 -m venv ~/.config/taux-gsc/venv && ~/.config/taux-gsc/venv/bin/pip install \
       google-api-python-client google-auth-oauthlib
     Known to work: google-api-python-client 2.201.0, google-auth 2.61.0, google-auth-oauthlib 1.5.0.
  4. Consent once, in that venv. The usual installed-app flow, not run from this repo:
       from google_auth_oauthlib.flow import InstalledAppFlow
       f = InstalledAppFlow.from_client_secrets_file('client_secret.json',
           ['https://www.googleapis.com/auth/webmasters.readonly'])
       open('token.json', 'w').write(f.run_local_server(port=0).to_json())
     then chmod 600 token.json. The refresh token inside renews itself on every run.

The domain property (sc-domain:taux.io) covers every subdomain, so twse-mcp.taux.io is in these
numbers too.

  python3 scripts/gsc.py sites              the properties this token can read
  python3 scripts/gsc.py overview [days]    clicks, impressions, top queries and pages, sitemaps (default 28)
  python3 scripts/gsc.py index [url ...]    is it indexed? (default: every url in the sitemap, plus the services)

GSC_SITE picks another property, e.g. GSC_SITE=sc-domain:example.com; GSC_SERVICES lists extra urls for `index`.
"""
import os, sys, json, pathlib

GSC = pathlib.Path(os.environ.get('GSC_DIR', pathlib.Path.home() / '.config' / 'taux-gsc'))
SITE = os.environ.get('GSC_SITE', 'sc-domain:taux.io')
# Extra URLs the `index` command checks besides the sitemap, comma-separated. The default is the one
# subdomain this repo's property carries; any other GSC_SITE gets none unless GSC_SERVICES says so.
SERVICES = [u for u in os.environ.get('GSC_SERVICES', 'https://twse-mcp.taux.io/' if SITE == 'sc-domain:taux.io' else '').split(',') if u]


def service():
    """The API client, re-execing into the venv when this interpreter lacks the libraries."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError:
        venv, root = GSC / 'venv' / 'bin' / 'python', GSC / 'venv'
        # sys.prefix, not the path of the binary: a venv's python is a symlink to the same base interpreter,
        # so comparing resolved paths says 「already inside」 even from the system python and loops nowhere.
        inside = pathlib.Path(sys.prefix) == root
        if venv.exists() and not inside:
            os.execv(str(venv), [str(venv), *sys.argv])      # same command, an interpreter that can run it
        sys.exit(f'缺少 google-api-python-client。' + (f'{root} 裡也沒有，請重裝。' if inside
                 else f'找不到 {venv}。') + '見這個檔案開頭的說明。')
    tok = GSC / 'token.json'
    if not tok.exists():
        sys.exit(f'找不到 {tok}。憑證不在 repo 裡，向負責人取得，或重新跑一次 OAuth 同意流程。')
    c = Credentials.from_authorized_user_file(str(tok))
    if not c.valid:
        c.refresh(Request())                                  # the refresh token renews the short-lived one
        # Merge, never overwrite. to_json() here (google-auth 2.61) leaves out client_id, client_secret and
        # scopes for a credential built by from_authorized_user_file, so writing it straight back reduced
        # token.json to {"refresh_token": …} and the next run could not refresh at all (measured,
        # 2026-10-08). The token may be shared, so a bad write here breaks every tool that reads it.
        merged = {**json.loads(tok.read_text()), **{k: v for k, v in json.loads(c.to_json()).items() if v is not None}}
        if not all(merged.get(k) for k in ('refresh_token', 'client_id', 'client_secret')):
            sys.exit(f'續約後的 token 缺欄位，不寫回 {tok}（寫壞了就要重新授權）。')
        tok.write_text(json.dumps(merged))
        tok.chmod(0o600)
    from googleapiclient.discovery import build
    return build('searchconsole', 'v1', credentials=c, cache_discovery=False)


def sites(svc, _args):
    for s in svc.sites().list().execute().get('siteEntry', []):
        print(f"  {s['permissionLevel']:22} {s['siteUrl']}")


def overview(svc, args):
    from datetime import date, timedelta
    days = int(args[0]) if args else 28
    end = date.today() - timedelta(days=3)                    # Search Console runs about three days behind
    start = end - timedelta(days=days - 1)

    def q(dims=None, n=10):
        body = {'startDate': str(start), 'endDate': str(end), 'rowLimit': n}
        if dims:
            body['dimensions'] = dims
        return svc.searchanalytics().query(siteUrl=SITE, body=body).execute().get('rows', [])

    print(f"=== {SITE}  {start} ~ {end}（{days} 天）===")
    tot = q()
    if tot:
        r = tot[0]
        print(f"點擊 {r['clicks']:.0f}　曝光 {r['impressions']:.0f}　CTR {r['ctr'] * 100:.1f}%　平均排名 {r['position']:.1f}")
    else:
        print('（這段期間沒有資料）')
    for dim, label in [('query', '搜尋字詞'), ('page', '頁面')]:
        print(f'\n--- 前 10 {label} ---')
        rows = q([dim], 10)
        if not rows:
            print('  （無）')
        for r in rows:
            print(f"  {r['clicks']:>4.0f} 點擊 {r['impressions']:>6.0f} 曝光  排名 {r['position']:>5.1f}  {r['keys'][0][:72]}")
    print('\n--- Sitemaps ---')
    for s in svc.sitemaps().list(siteUrl=SITE).execute().get('sitemap', []):
        n = sum(int(x.get('submitted', 0)) for x in s.get('contents', []))
        print(f"  {s['path']}  已送出 {n}  最後下載 {s.get('lastDownloaded', '(未下載)')}  "
              f"錯誤 {s.get('errors', 0)}  警告 {s.get('warnings', 0)}")


def sitemap_urls():
    """The pages the site itself declares, so this list cannot drift from the routes."""
    import re, urllib.request
    host = SITE.removeprefix('sc-domain:')
    # urllib's default User-Agent gets a 403 from Cloudflare, so say who this is
    req = urllib.request.Request(f'https://{host}/sitemap.xml',
                                 headers={'user-agent': 'taux-gsc/1.0 (+https://taux.io; scripts/gsc.py)'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return re.findall(r'<loc>([^<]+)</loc>', r.read().decode())


def index(svc, args):
    urls = args or (sitemap_urls() + SERVICES)
    print(f"{'網址':46} {'結論':9} 索引狀態")
    for u in urls:
        try:
            r = svc.urlInspection().index().inspect(
                body={'inspectionUrl': u, 'siteUrl': SITE, 'languageCode': 'zh-TW'}).execute()
            i = r['inspectionResult']['indexStatusResult']
            print(f"{u:46} {i.get('verdict', '?'):9} {i.get('coverageState', '?')}"
                  f"  | 最後檢索 {(i.get('lastCrawlTime') or '(從未)')[:10]}")
        except Exception as e:                                 # one bad url must not lose the rest of the report
            print(f'{u:46} ERROR     {str(e)[:70]}')


CMDS = {'sites': sites, 'overview': overview, 'index': index}

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd not in CMDS:
        sys.exit(__doc__)
    CMDS[cmd](service(), sys.argv[2:])
