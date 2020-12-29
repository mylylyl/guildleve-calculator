import sys
import csv
import json
import requests


def get_url(id):
    return "http://www.garlandtools.org/db/doc/item/en/3/%d.json" % id


def get_item(id):
    resp = requests.get(get_url(id))
    if resp.status_code == 200:
        return json.loads(resp.content)
    else:
        print('[x] status code %d for %d' % (resp.status_code, i))
        return None


j = {}
l = {}
i = {}

leves = {}

try:
    with open('Leve.csv', encoding='utf-8') as file:
        f_csv = csv.DictReader(file)
        for row in f_csv:
            l[row['LeveId']] = {
                'Name': row['Name'],
                'Description': row['Description'],
            }
except:
    print('[x] failed to process Leve.csv: %s' % (sys.exc_info()[0]))

try:
    with open('Item.csv', encoding='utf-8') as file:
        f_csv = csv.DictReader(file)
        for row in f_csv:
            i[row['ItemId']] = {
                'Name': row['Name'],
                'Description': row['Description'],
            }
except:
    print('[x] failed to process Item.csv: %s' % (sys.exc_info()[0]))

# crafting jobs
JOBS = [9, 10, 11, 12, 13, 14, 15, 16]
# removed leves
FORBIDDEN_LEVES = [871]

for lid in range(1600):
    n = {
        "leve": {
            "name": "",
            "description": "",
            "id": 0,
            "patch": "3.0",
            "level": 0,
            "jobCategory": 0,
            "complexity": {},
            "is_large": False,
            "repeat": 0,
        },
        "require": {
            "id": 0,
            "name": "",
            "amount": 0,
        },
        "craft": [],
        "ic": [],
        "reward": {
            "exp": 0,
            "gil": 0,
            "items": [],
        }
    }

    try:
        with open('garland/%d.json' % lid, encoding='utf-8') as file:
            j = json.load(file)
    except:
        print('[x] failed to process %d.json: %s' % (lid, sys.exc_info()[0]))

    if 'leve' not in j.keys():
        continue

    if j['leve']['id'] in FORBIDDEN_LEVES:
        continue

    if j['leve']['jobCategory'] not in JOBS:
        continue

    # leve info
    n['leve']['id'] = lid
    n['leve']['patch'] = str(j['leve']['patch'])
    n['leve']['level'] = j['leve']['lvl']
    n['leve']['jobCategory'] = j['leve']['jobCategory']
    n['leve']['complexity'] = j['leve']['complexity']

    if 'repeats' not in j['leve'].keys():
        n['leve']['repeat'] = 0
    else:
        n['leve']['repeat'] = j['leve']['repeats']

    # check for large
    if '(L)' in j['leve']['name']:
        n['leve']['is_large'] = True

    n['leve']['name'] = l[str(lid)]['Name']
    n['leve']['description'] = l[str(lid)]['Description']

    # require info
    if 'requires' in j['leve'].keys():
        n['require']['id'] = j['leve']['requires'][0]['item']
        n['require']['name'] = i[str(n['require']['id'])]['Name']
        if 'amount' not in j['leve']['requires'][0].keys():
            n['require']['amount'] = 1
        else:
            n['require']['amount'] = j['leve']['requires'][0]['amount']

    # reward info
    n['reward']['exp'] = j['leve']['xp']
    n['reward']['gil'] = j['leve']['gil']

    for entry in j['rewards']['entries']:
        t = {
            "id": 0,
            "name": "",
            "rate": 0,
            "amount": 0,
        }
        t['id'] = entry['item']
        t['name'] = i[str(t['id'])]['Name']
        t['rate'] = entry['rate']
        if 'amount' not in entry.keys():
            t['amount'] = 1
        else:
            t['amount'] = entry['amount']

        n['reward']['items'].append(t)

    # craft info
    n['craft'] = j['ingredients'][0]['craft']
    # store ingredient crafting info
    ic = {}
    processed_ingredients = []
    stack = []

    for recipe in n['craft']:
        for ingredient in recipe['ingredients']:
            if ingredient['id'] <= 19:
                # the stones
                continue
            stack.append(ingredient['id'])

    for sid in stack:
        if sid in processed_ingredients:
            continue
        resp = get_item(sid)
        if resp is None:
            print('failed to get item %d, no resp' % sid)
            continue
        if 'item' not in resp.keys():
            print('failed to get item %d, no item' % sid)
            continue
        if 'craft' not in resp['item'].keys():
            # print('%d(%s) is not craftable' % (sid, i[str(sid)]['Name']))
            processed_ingredients.append(sid)
            continue

        ic[str(sid)] = resp['item']['craft']
        processed_ingredients.append(sid)

        for recipe in resp['item']['craft']:
            for ingredient in recipe['ingredients']:
                if ingredient['id'] <= 19:
                    # the stones
                    continue
                stack.append(ingredient['id'])

    # get chs name
    for receipe in n['craft']:
        for ingredient in receipe['ingredients']:
            ingredient['name'] = i[str(ingredient['id'])]['Name']

    for ic_item in ic.keys():
        for receipe in ic[ic_item]:
            for ingredient in receipe['ingredients']:
                ingredient['name'] = i[str(ingredient['id'])]['Name']

    n['ic'] = ic

    # add leve to corresponding job json
    tl = {
        'id': lid,
        'text': '%s (需求物品: %s, 任务次数: %d)' % (n['leve']['name'], n['require']['name'], n['leve']['repeat'] + 1),
    }

    if str(n['leve']['jobCategory']) not in leves.keys():
        leves[str(n['leve']['jobCategory'])] = []

    leves[str(n['leve']['jobCategory'])].append(tl)

    try:
        with open('localized/%d.json' % lid, 'w', encoding='utf8') as file:
            json.dump(n, file, ensure_ascii=False)
    except:
        print('[x] failed to write %d.json: %s' % (lid, sys.exc_info()[0]))

    print('done %d' % lid)

for job in leves.keys():
    try:
        with open('jobs/job_%s.json' % job, 'w', encoding='utf8') as file:
            json.dump(leves[job], file, ensure_ascii=False)
    except:
        print('[x] failed to write job_%s.json: %s' % (job, sys.exc_info()[0]))
