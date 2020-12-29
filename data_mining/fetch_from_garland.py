import requests, json, sys

def get_url(id):
    return "http://www.garlandtools.org/db/doc/leve/en/3/%d.json" % id

for i in range(0, 1600):
    resp = requests.get(get_url(i))
    if resp.status_code == 200:
        try:
            with open(str(i)+'.json', 'wb') as file:
                file.write(resp.content)
        except:
            print('[x] failed to save %d: %s' % (i, sys.exc_info()[0]))
    else:
        print('[x] status code %d for %d' % (resp.status_code, i))