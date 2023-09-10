import jwt_decode from 'jwt-decode';

/* 
{
  "iss": "https://dev-ofc2nc2a0lc4ncig.eu.auth0.com/",
  "sub": "google-oauth2|104982419532132937804",
  "aud": [
    "https://api.haargos.smartrezydencja.pl",
    "https://dev-ofc2nc2a0lc4ncig.eu.auth0.com/userinfo"
  ],
  "iat": 1693566766,
  "exp": 1693653166,
  "azp": "3EGUK8VIxgWNygQ1My32IIMeFz2KFeXm",
  "scope": "openid profile email"
}
*/
function decodeAuth0JWT(jwt: string) {
  const { sub }: { sub: string } = jwt_decode(jwt);
  return { subIdentifier: sub.split('|')[1] };
}
module.exports = { decodeAuth0JWT };
