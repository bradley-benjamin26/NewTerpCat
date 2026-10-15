# External system urls
UMD = {
    "key": "umd",
    "name": "University of Maryland",
    "base_url": "https://usmai-umcp.alma.exlibrisgroup.com/view/sru/01USMAI_UMCP",
    "verified": True,
    "focus": True,
    "region": "umd",
    "record_url_template": "https://usmai-umcp.alma.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01USMAI_UMCP:UMCP",
}

UMD_ILLIAD_BASE_URL = "https://docdel.umd.edu/illiad/illiad.dll/OpenURL"

BTAA_LIBRARIES = [
    {"key": "rutgers", "name": "Rutgers University",
     "base_url": "https://rutgers.primo.exlibrisgroup.com/view/sru/01RUT_INST", "verified": True,
     "region": "east_coast",
     "record_url_template": "https://rutgers.primo.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01RUT_INST:01RUT"},
    {"key": "nebraska", "name": "University of Nebraska-Lincoln",
     "base_url": "https://unl.primo.exlibrisgroup.com/view/sru/01UON_LINC", "verified": True,
     "region": "midwest",
     "record_url_template": "https://unl.primo.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01UON_LINC:UNL"},
    {"key": "washington", "name": "University of Washington",
     "base_url": "https://orbiscascade-washington.primo.exlibrisgroup.com/view/sru/01ALLIANCE_UW", "verified": True,
     "region": "west_coast",
     "record_url_template": "https://orbiscascade-washington.primo.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01ALLIANCE_UW:UW"},
    {"key": "minnesota", "name": "University of Minnesota",
     "base_url": "https://primo.lib.umn.edu/view/sru/01UMN_INST", "verified": True,
     "region": "midwest",
     "record_url_template": "https://primo.lib.umn.edu/discovery/fulldisplay?docid=alma{mms_id}&vid=01UMN_INST:TWINCITIES"},
    {"key": "oregon", "name": "University of Oregon",
     "base_url": "https://alliance-uoregon.primo.exlibrisgroup.com/view/sru/01ALLIANCE_UO", "verified": True,
     "region": "west_coast",
     "record_url_template": "https://alliance-uoregon.primo.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01ALLIANCE_UO:UO"},
    {"key": "purdue", "name": "Purdue University",
     "base_url": "https://purdue.primo.exlibrisgroup.com/view/sru/01PURDUE_PUWL", "verified": True,
     "region": "midwest",
     "record_url_template": "https://purdue.primo.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01PURDUE_PUWL:PURDUE"},
    {"key": "northwestern", "name": "Northwestern University",
     "base_url": "https://search.library.northwestern.edu/view/sru/01NWU_INST", "verified": True,
     "region": "midwest",
     "record_url_template": "https://search.library.northwestern.edu/discovery/fulldisplay?docid=alma{mms_id}&vid=01NWU_INST:NULV_NDE"},
    {"key": "ucla", "name": "UCLA",
     "base_url": "https://search.library.ucla.edu/view/sru/01UCS_LAL", "verified": True,
     "region": "west_coast",
     "record_url_template": "https://search.library.ucla.edu/discovery/fulldisplay?docid=alma{mms_id}&vid=01UCS_LAL:UCLA"},
    {"key": "usc", "name": "University of Southern California",
     "base_url": "https://uosc.primo.exlibrisgroup.com/view/sru/01USC_INST", "verified": True,
     "region": "west_coast",
     "record_url_template": "https://uosc.primo.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01USC_INST:01USC"},
    {"key": "illinois", "name": "University of Illinois Urbana-Champaign",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "midwest"},
    {"key": "osu", "name": "Ohio State University",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "midwest"},
    {"key": "michigan", "name": "University of Michigan",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "midwest"},
    {"key": "iowa", "name": "University of Iowa",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "midwest"},
    {"key": "indiana", "name": "Indiana University",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "midwest"},
    {"key": "msu", "name": "Michigan State University",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "midwest"},
    {"key": "wisconsin", "name": "University of Wisconsin-Madison",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "midwest"},
    {"key": "psu", "name": "Pennsylvania State University",
     "base_url": None, "verified": False, "note": "Unverified.", "region": "east_coast"},
]

ALL_LIBRARIES = [UMD] + BTAA_LIBRARIES
VERIFIED_LIBRARIES = [lib for lib in ALL_LIBRARIES if lib.get("verified")]
LIBRARY_BY_KEY = {lib["key"]: lib for lib in ALL_LIBRARIES}

REGION_DISTANCE_POINTS = {
    "umd": 4,
    "east_coast": 3,
    "midwest": 2,
    "west_coast": 1,
}