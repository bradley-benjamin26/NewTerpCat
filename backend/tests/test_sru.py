from pathlib import Path

from app.sru import cql_query, parse_response

FIXTURES = Path(__file__).parent / "fixtures"


def test_parses_print_record_with_holdings():
    result = parse_response((FIXTURES / "sru_umd_print.xml").read_bytes())
    assert result["total"] == 1
    rec = result["records"][0]
    assert rec["id"] == "990020965100108238"
    assert rec["title"] == (
        "Monitoring Maryland's Chesapeake Bay oysters : a comprehensive "
        "characterization of modified fall survey results, 1990-1991"
    )
    assert rec["author"] == "Smith, Gary Frederick"
    assert rec["date"] == "1992"
    assert rec["url"] == (
        "https://usmai-umcp.alma.exlibrisgroup.com/discovery/fulldisplay"
        "?docid=alma990020965100108238&vid=01USMAI_UMCP:UMCP"
    )
    assert rec["online"] is False
    assert rec["holdings"] == [
        {"location": "Maryland Folio", "call_number": "SH365.M3 S55 1992", "status": "available"}
    ]


def test_parses_electronic_records():
    result = parse_response((FIXTURES / "sru_umd.xml").read_bytes())
    assert result["total"] == 505
    assert len(result["records"]) == 3
    assert all(r["online"] and r["holdings"] == [] for r in result["records"])
    assert result["records"][0]["author"] == "United States. Congress. Senate. Committee on Commerce"
    assert result["records"][1]["author"] == "Macleod, James Farquharson"
    assert result["records"][0]["date"] == "1943"


def test_cql_query_quotes_and_escapes_input():
    assert cql_query("oysters") == 'alma.all_for_ui="oysters"'
    assert cql_query('say "hi" \\ now') == 'alma.all_for_ui="say \\"hi\\" \\\\ now"'


def test_falls_back_to_corporate_author():
    xml = b"""<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><numberOfRecords>1</numberOfRecords>
    <records><record><recordData><record xmlns="http://www.loc.gov/MARC21/slim">
      <controlfield tag="001">99123</controlfield>
      <datafield tag="110" ind1="2" ind2=" "><subfield code="a">Maryland. Department of Natural Resources.</subfield></datafield>
      <datafield tag="245" ind1="1" ind2="0"><subfield code="a">Oyster report.</subfield></datafield>
    </record></recordData></record></records></searchRetrieveResponse>"""
    assert parse_response(xml)["records"][0]["author"] == "Maryland. Department of Natural Resources"
