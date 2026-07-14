#!/usr/bin/env python3
"""
verify-purchases-exports.py
Vérifie que les 4 exports Excel Achats répondent correctement.

Le script utilise le chemin de téléchargement réel du navigateur :
  GET /api/purchases/reports/<type>/export.xlsx?token=<session-token>
(même mécanisme qu'un clic sur le bouton "Exporter" dans l'ERP).

Usage :
  python3 scripts/src/verify-purchases-exports.py [options]

Options :
  --base-url URL    Racine de l'API  (défaut : http://localhost:80)
  --token TOKEN     Token de session UUID déjà obtenu (bypass du login)

Variables d'environnement requises si --token est absent :
  LOGIN_EMAIL       Adresse e-mail du compte
  LOGIN_PASSWORD    Mot de passe du compte

  En environnement de développement, si le compte active la 2FA,
  le script utilise le devOtp retourné par le serveur. Ce mécanisme
  n'est disponible qu'en développement (NODE_ENV=development).

Critères de succès pour chaque export :
  - HTTP 200
  - Content-Type : application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - Content-Disposition : attachment; filename="purchases-<type>-<YYYY-MM-DD>.xlsx"
  - Corps > 1 000 octets
  - Magic bytes ZIP valides (50 4B 03 04)
  - Classeur contient au moins 2 feuilles (Couverture + données)

Exit code : 0 si tout passe, 1 en cas d'échec.

Exemple d'exécution :
  LOGIN_EMAIL=user@example.com LOGIN_PASSWORD=secret \\
    python3 scripts/src/verify-purchases-exports.py --base-url http://localhost:80
"""

import argparse
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile

EXPORT_TYPES = ["aging", "by-period", "by-supplier", "unpaid"]


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def authenticate(base_url: str) -> str:
    """
    Effectue le flux login (+ 2FA devOtp si nécessaire) et retourne le token
    de session UUID. Requiert les variables d'env LOGIN_EMAIL et LOGIN_PASSWORD.
    """
    email = os.environ.get("LOGIN_EMAIL", "")
    password = os.environ.get("LOGIN_PASSWORD", "")
    if not email or not password:
        raise RuntimeError(
            "Variables d'environnement LOGIN_EMAIL et LOGIN_PASSWORD requises. "
            "Exemple : LOGIN_EMAIL=user@example.com LOGIN_PASSWORD=secret "
            "python3 scripts/src/verify-purchases-exports.py"
        )

    resp1 = post_json(f"{base_url}/api/auth/login", {"email": email, "password": password})

    if "token" in resp1:
        return str(resp1["token"])

    if resp1.get("status") == "2fa_required":
        temp_token = resp1.get("tempToken", "")
        dev_otp = resp1.get("devOtp")
        if not dev_otp:
            raise RuntimeError(
                "2FA requis mais devOtp absent — ce mécanisme n'est disponible "
                "qu'en développement (NODE_ENV=development). "
                "Passez --token avec un token déjà obtenu."
            )
        resp2 = post_json(
            f"{base_url}/api/auth/login/verify-2fa",
            {"tempToken": temp_token, "code": str(dev_otp)},
        )
        if "token" not in resp2:
            raise RuntimeError(f"Échec 2FA : {resp2}")
        return str(resp2["token"])

    raise RuntimeError(f"Réponse de login inattendue : {resp1}")


def check_export(base_url: str, export_type: str, token: str) -> list[str]:
    """
    Teste l'endpoint d'export en passant le token en query string,
    exactement comme le fait le navigateur lors d'un clic "Exporter".
    Retourne la liste des erreurs (vide = succès).
    """
    errors: list[str] = []
    qs = urllib.parse.urlencode({"token": token})
    url = f"{base_url}/api/purchases/reports/{export_type}/export.xlsx?{qs}"

    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = resp.status
            ct = resp.headers.get("Content-Type", "")
            cd = resp.headers.get("Content-Disposition", "")
            body = resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read()
        errors.append(f"HTTP {exc.code}: {exc.reason} — {body[:200]!r}")
        return errors

    if status != 200:
        errors.append(f"Attendu HTTP 200, obtenu {status}")

    expected_ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if expected_ct not in ct:
        errors.append(f"Content-Type incorrect : {ct!r}")

    date_pattern = re.compile(
        r"purchases-" + re.escape(export_type) + r"-\d{4}-\d{2}-\d{2}\.xlsx"
    )
    if not date_pattern.search(cd):
        errors.append(f"Content-Disposition incorrect : {cd!r}")

    if len(body) < 1000:
        errors.append(f"Corps trop petit ({len(body)} octets) — fichier probablement vide")

    if body[:4] != b"PK\x03\x04":
        errors.append(f"Magic bytes ZIP invalides : {body[:4].hex()!r} — fichier corrompu")
    else:
        try:
            zf = zipfile.ZipFile(io.BytesIO(body))
            wb_xml = zf.read("xl/workbook.xml").decode(errors="replace")
            sheet_names = re.findall(r'name="([^"]+)"', wb_xml)
            data_sheets = [s for s in sheet_names if not s.startswith("_xlnm")]
            if len(data_sheets) < 2:
                errors.append(f"Trop peu de feuilles dans le classeur : {data_sheets!r}")
        except Exception as exc:
            errors.append(f"Lecture du classeur Excel échouée : {exc}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Vérifie les 4 exports Excel Achats (path query-token — même mécanisme que le navigateur)"
    )
    parser.add_argument("--base-url", default="http://localhost:80", help="Racine de l'API")
    parser.add_argument(
        "--token", default=None,
        help="Token de session UUID (si absent, authentification via LOGIN_EMAIL / LOGIN_PASSWORD)"
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    token = args.token
    if not token:
        print(f"  Authentification sur {base_url} …", flush=True)
        try:
            token = authenticate(base_url)
            print("  Token de session obtenu ✓", flush=True)
        except RuntimeError as exc:
            print(f"\nÉCHEC authentification : {exc}", file=sys.stderr)
            return 1

    print(f"\nTest des 4 exports Excel Achats — {base_url}", flush=True)
    print("  Mécanisme : GET /api/purchases/reports/<type>/export.xlsx?token=<session-token>", flush=True)
    print()

    all_passed = True
    for export_type in EXPORT_TYPES:
        errs = check_export(base_url, export_type, token)
        if errs:
            print(f"  ❌ {export_type}")
            for e in errs:
                print(f"       • {e}")
            all_passed = False
        else:
            print(
                f"  ✅ {export_type} — "
                "HTTP 200 · Content-Type xlsx · Content-Disposition OK · "
                "ZIP valide · ≥2 feuilles"
            )

    print()
    if all_passed:
        print("Tous les exports passent ✅")
        return 0

    print("Des exports ont échoué ❌", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
