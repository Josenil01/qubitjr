$ErrorActionPreference = 'Stop'
$catalog = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'catalogo.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$labels = @{'03'='Domésticos e da fazenda';'04'='Selvagens';'05'='Polares';'06'='Aquáticos';'07'='Aves';'08'='Répteis e anfíbios';'09'='Insetos e aracnídeos'}
$sections = foreach ($group in ($catalog | Group-Object order)) {
    $code = [regex]::Match($group.Name, ',(\d{2}) ').Groups[1].Value
    $cards = foreach ($animal in $group.Group) {
        $id = [System.IO.Path]::GetFileNameWithoutExtension($animal.md5)
        $label = switch ($id) { 'HY-Rabbit' { 'Coelho · variante' }; 'HY-Wolf' { 'Lobo' }; 'HY-Turtle' { 'Tartaruga · variante' }; default { $animal.name } }
        $safeLabel = [System.Net.WebUtility]::HtmlEncode($label)
        $artPath = Join-Path $PSScriptRoot ($id + '.png')
        $version = (Get-FileHash -LiteralPath $artPath -Algorithm SHA256).Hash.Substring(0,12).ToLowerInvariant()
        '<figure><a href="./' + $id + '.png"><img src="./' + $id + '.png?v=' + $version + '" width="1254" height="1254" alt="' + $safeLabel + ' chibi"></a><figcaption>' + $safeLabel + '</figcaption></figure>'
    }
    '<section id="categoria-' + $code + '"><h2>' + $labels[$code] + ' <small>' + $group.Count + ' animais</small></h2><div class="grid">' + ($cards -join "`n") + '</div></section>'
}
$nav = foreach ($code in @('03','04','05','06','07','08','09')) { '<a href="#categoria-' + $code + '">' + $labels[$code] + '</a>' }
$prefix = @'
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>QubitJr · animais chibi</title>
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;padding:28px;color:#513321;background:#fff6e5;font:16px system-ui,sans-serif}h1{margin:0 0 8px;font-size:30px}p{max-width:900px;line-height:1.5}a{color:inherit}nav{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}nav a,.theme{padding:9px 14px;border:1px solid #dbc7ac;border-radius:24px;text-decoration:none;cursor:pointer}section{margin:34px 0;scroll-margin-top:20px}h2{font-size:23px}small{font-size:14px;font-weight:400;margin-left:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px}figure{margin:0;padding:14px;border:1px solid #ead9bf;border-radius:18px;background:white}figure img{display:block;width:100%;height:230px;object-fit:contain;background:repeating-conic-gradient(#f5f0e8 0% 25%,#fff 0% 50%) 0/20px 20px}figcaption{text-align:center;font-weight:600;margin-top:12px}.controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}input{accent-color:#795335}.reference{display:flex;gap:20px;align-items:center;margin:20px 0}.reference img{width:120px;height:120px;object-fit:contain}body:has(#dark:checked){background:#25252b;color:#fff}body:has(#dark:checked) figure{background:#34343c;border-color:#555}body:has(#dark:checked) figure img{background:#34343c}body:has(#plain:checked) figure img{background:white}.note{font-size:14px;color:#765b48}@media(max-width:520px){body{padding:16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{padding:8px}figure img{height:150px}figcaption{font-size:14px}}
</style></head><body>
<h1>QubitJr · animais chibi</h1>
<p>58 animais em sete categorias. Mesmo padrão de contorno marrom, olhos brilhantes sem cílios e sombras suaves. Clique nas artes para abrir os PNGs completos.</p>
<div class="controls"><span>Fundo:</span><label class="theme"><input type="radio" name="background" id="checker" checked> Quadriculado</label><label class="theme"><input type="radio" name="background" id="plain"> Branco</label><label class="theme"><input type="radio" name="background" id="dark"> Escuro</label></div>
<div class="reference"><img src="./HY-Vaca.png" alt="Vaca de referência"><p><strong>Referência aprovada</strong><br>Vaca chibi · proporções, olhos, contornos e acabamento comuns ao lote.</p></div>
<p class="note">Padrão aplicado à biblioteca oficial. Arquivos anteriores preservados em backup-biblioteca-original. Versões legadas ocultas, fantasia, dinossauros e folclore ficam fora deste conjunto.</p>
'@
$html = $prefix + '<nav aria-label="Categorias">' + ($nav -join "`n") + '</nav><main>' + ($sections -join "`n") + '</main></body></html>'
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'comparacao.html'), $html, [System.Text.UTF8Encoding]::new($false))
