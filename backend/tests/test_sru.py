from pathlib import Path

import pytest

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


def part(keywords, headings=(), people=(), operator=None):
    return {
        "operator": operator,
        "keywords": keywords,
        "subjects": [{"phrase": "p", "headings": h} for h in headings],
        "people": list(people),
    }


def test_cql_query_quotes_and_escapes_input():
    assert cql_query([part(["oysters"])]) == 'alma.all_for_ui all "oysters"'
    assert cql_query([part(['say "hi"', "\\", "now"])]) == 'alma.all_for_ui all "say \\"hi\\" \\\\ now"'


def test_cql_query_ors_keywords_people_and_subjects():
    assert cql_query([part(["climate", "change"], [["Climatic changes"]], ["Toni Morrison"])]) == (
        'alma.all_for_ui all "climate change" OR alma.creator all "Toni Morrison" OR alma.subjects="Climatic changes"'
    )


def test_cql_query_needs_one_heading_from_every_phrase():
    assert cql_query([part(["history", "jazz", "music"], [["History"], ["Jazz", "Jazz musicians"]])]) == (
        'alma.all_for_ui all "history jazz music" OR '
        'alma.subjects="History" AND alma.subjects="Jazz" OR '
        'alma.subjects="History" AND alma.subjects="Jazz musicians"'
    )


def test_cql_query_ands_parts_without_parentheses():
    # Alma mishandles parentheses but binds AND tighter than OR, so the query is an OR of ANDs.
    query = cql_query(
        [part(["french", "revolution"], [["France--History--Revolution, 1789-1799"]]), part(["economy"], operator="AND")]
    )
    assert query == (
        'alma.all_for_ui all "french revolution" AND alma.all_for_ui all "economy" OR '
        'alma.subjects="France--History--Revolution, 1789-1799" AND alma.all_for_ui all "economy"'
    )


def test_cql_query_or_offers_either_part():
    assert cql_query([part(["jazz"]), part(["oysters"], operator="OR")]) == (
        'alma.all_for_ui all "jazz" OR alma.all_for_ui all "oysters"'
    )


def test_cql_query_not_excludes_by_keyword_from_every_alternative():
    assert cql_query([part(["jazz"], [["Jazz"]]), part(["blues"], operator="NOT")]) == (
        'alma.all_for_ui all "jazz" NOT alma.all_for_ui all "blues" OR alma.subjects="Jazz" NOT alma.all_for_ui all "blues"'
    )


def test_cql_query_and_and_not_bind_tighter_than_or():
    parts = [part(["a"]), part(["b"], operator="AND"), part(["c"], operator="OR"), part(["d"], operator="NOT")]
    assert cql_query(parts) == (
        'alma.all_for_ui all "a" AND alma.all_for_ui all "b" OR alma.all_for_ui all "c" NOT alma.all_for_ui all "d"'
    )


def test_cql_query_rejects_a_group_with_only_exclusions():
    with pytest.raises(ValueError):
        cql_query([part(["rock"], operator="NOT")])


def test_falls_back_to_corporate_author():
    xml = b"""<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><numberOfRecords>1</numberOfRecords>
    <records><record><recordData><record xmlns="http://www.loc.gov/MARC21/slim">
      <controlfield tag="001">99123</controlfield>
      <datafield tag="110" ind1="2" ind2=" "><subfield code="a">Maryland. Department of Natural Resources.</subfield></datafield>
      <datafield tag="245" ind1="1" ind2="0"><subfield code="a">Oyster report.</subfield></datafield>
    </record></recordData></record></records></searchRetrieveResponse>"""
    assert parse_response(xml)["records"][0]["author"] == "Maryland. Department of Natural Resources"
