from app.services.job_reader import _TextExtractor


def _extract(html: str) -> str:
    p = _TextExtractor()
    p.feed(html)
    return p.text()


def test_extracts_visible_text_and_drops_scripts_styles():
    html = """
    <html><head><title>x</title><style>.a{color:red}</style></head>
    <body>
      <script>var x = 1;</script>
      <h1>Backend Engineer</h1>
      <p>We need Python and REST API skills.</p>
      <div>Location: Jakarta</div>
    </body></html>
    """
    text = _extract(html)
    assert "Backend Engineer" in text
    assert "Python and REST API skills" in text
    assert "Location: Jakarta" in text
    # script/style content must not leak in
    assert "var x" not in text
    assert "color:red" not in text


def test_block_tags_produce_line_breaks():
    html = "<p>Line one</p><p>Line two</p>"
    text = _extract(html)
    assert "Line one" in text
    assert "Line two" in text
    assert "\n" in text
