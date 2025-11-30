import * as THREE from 'three';

const DEFAULT_TILE_SIZE = 1024;
const SYMBOL_COLOR = '#b3001b';
const FRONT_COLOR = '#f7f2e8'; // slightly warm white to avoid monitor-like pure white
const FRONT_BORDER_COLOR = '#e6e0d5';
const FRONT_NOISE_LEVEL = 3;
const GOLD_BASE_COLOR = '#f2c14b';
const GOLD_NOISE_LEVEL = 8; // subtle 2-3% brightness variation

type RandomSource = () => number;

function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// Inlined reference glyph (zhong.png) with transparent background; used as a mask and tinted to SYMBOL_COLOR.
const GLYPH_DATA_URL =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAQAElEQVR4AeydB5xuV1nuv5nJqTnnBMQLCKIiIIheinRblCLSO0S9EiO9WLgIFprAVVCQXqQFgvSOJvReBIEAUUqEEAgECGAScsqcljlz//93Zs+Z8tXZ+5v59t7v/Pb7rd6etdaz37X22numO/mXCCQCiUBNEEjCqklHZTUTgUSg00nCylGQCCQCtUEgCas2XVW+oplDIlB3BJKw6t6DWf9EoEUIJGG1qLOzqYlA3RFIwqp7D2b9E4FuCDTULwmroR2bzUoEmohAElYTezXblAg0FIEkrIZ2bDYrEWgiAklY3Xo1/RKBRGAiEUjCmshuyUolAolANwSSsLqhkn6JQCIwkQgkYU1kt2SlNg6BLKlOCCRh1am3sq6JQMsRSMJq+QDI5icCdUIgCatOvZV1TQRajkBJwmo5etn8RCAR2FAEkrA2FO4sLBFIBMogkIRVBr1MmwgkAhuKQBLWhsJd68Ky8onApiOQhLXpXZAVSAQSgWERSMIaFqmMlwgkApuOQBLWpndBViARmDwEJrVGSViT2jNZr0QgEViDQBLWGkjSIxFIBCYVgSSsSe2ZrFcikAisQSAJaw0k5T0yh0QgERgPAklY48E1c00EEoExIJCENQZQG5Cl4+KU6enpF27duvVNtOcdO3bseCbmvZCrIXklApuCgANzUwrOQicWgUdRs29DVq8/duzYw48cOXIf3Hc7ePDgo/F7C/YLkXNnZmaeh3lHZDfS3itbvqEIJGFtKNwTXdj26enp06nhszCvDll1ICWcnc4JJ5zQwa+jHx5T27Ztu+7c3NyfbNmy5SzcF09NTX2Q8Idh/ykkr0RgbAhMjy3nzLhOCGyFhN4BIZ1mpVkGanQgojAvv/zygqzCffjw4TCPHj2quYWfW8/Pz78I89vIRyGyR2DuQfJKBCpFIAmrUjjrmRlk9TRI6PbsU3Ukq0OHDkVDJKqw9PlRC4OsOgqa2AlE/U2I7LmYP0LrOgPzpsgUklciUBqBzSWs0tXPDKpAALI6TaJin6rDnlUs/yCfMAflz9Iwlo7Gl+AkMNLMbN++fSuEdX/sn0XOhhTvgplXIlAKgSSsUvA1IvE2yGqHRLVINrH8k3yGaZ1EJWmxnIzo2iGrjlpakQea240hxX8lwjkQ110xU+MChLxGRyAJa3TMmpbCDal32Cj3rNh/ik123S7zNPuJpCRpSViQUUSVrLTrj5bVgayK/bAbYH8bxPh+Il4TySsRGAmBJKyR4GpmZLSrJ0BUP5B82H/qaKolDUNYyxEx7e7dC6ccIKbIRyJTZmZmCiKcIc1tkC9BZo/GnELySgSGQiAJayiYGh/pPFroHtN+zNiTgsS0DiUS3M6dO2MpuW/fvtj7QosKrUpNy0yMo+iWCNHmduLvYdS3YW5F8koEBiKQhDUQonZEQDv6LEu4u0E0B92HklTQuoZu/OzsbBCdCdCcOkUealq6i7x0m7ei5kX8uyNuzOcZLoDIqz8CSVj98WlVKBrQhyCaO0NaRyUZSGyp/WzMh13/QsJj2Q9pw0U+YRY/EtPyvCSrIkwTbesGmO9CFtaTWPKqNQJjq3wS1tigrW3GQVqQzxFboGYkQRWEI/mgicXyT9M4ZaRYImLeiHzORPJKBHoikITVE5pWB7yP1t9TTUuikqTUitxQRxuKs1qS1WpNijQjXy4RTaR54okn/iZ2T8lj5JUIrEUgCWstJumzgMBZkNRzJSg31NWy3FCHxCJUd1hK/qBZxSa92XhwFfNpyJWRvBKBNQgkYa2BZNM9JqYCaFaPg7S+5oa6GpXkVWhVPkWUbMpWVs2Kcjoeo9Akv53YH4SZVyKwBoEkrDWQpMcyBI6wh/UHbLjPSVCSlmGaalqSje4yYj5qax42lRApawa7Tw7LZJtpG4pAElZDO7aqZrGH9TnI6jmSCfY4uqAmpOhXthw295c28NHmOpZBvj41LJt1pm8gAklYDezUMTTpKWhVs2pDEozEolRRDuQUe1guNc3ffBFPvytVFDHReWTlRkMgCWs0vNoaey+az5ttPMQVBKNdstEsI5KU2pp5SIYuDynjXNzzSF6JwAoEkrBWwJGOXghAIi+RUNSENCWWgmh6pRnG3/yM5wa+Yp74vVK/lERgNQJJWKsRSXdXBCCRT/H07itsioeGxWZ813ijekp8ihv4khX5fpM8/HopRl6JwEoEak1YK5uSrnEjwNO7M9iAj2IkGJdz4SjxI0l5zsssWHa66f5k7H7yBiOvRGAlAklYK/FIV38EPsy+FRxzrIMmFC84948+OFTtav/+/aG1Efsi5DVIXolAVwSSsLrCkp49EDiXJ3jT7GfFt656xBnJW8KCBIujDW8g8RySVyLQFYEkrK6wpGcPBPaxDLyQ/az4pxM94ozkvSyvecjrpT0TZ0AiAAJJWICQ1/AI8ITway4HTeEGvGYZKfLCPJf9sa+WySvTNh+BJKzm93GlLUQL+i83x13GQTCl8zYv8lRj8zvvpfPLDJqNQBJWs/t3HK1b+KeFFeYsYbE09AN+FeaaWdUXgd41T8LqjU2GdEfgaHfv9fmyFHQDfx+pP4HklQj0RSAJqy88GdgFgUpfmXFJSBnuXR3AzCsR6ItAElZfeDJw3Ah4RIIl4WfGXU7m3wwEkrCa0Y/LWlEvK3tXfrLm8/WqddZ2sxBIwtos5LPcJQRYFqaGtYRGWvohkITVD50MGzsCU1NTPnV0D2vsZWUB9UcgCav+fbgpLZifH27vHUKK/wBdmKsrSz7fwG+4zIiY1woEWudIwmpdl5ducKXkApH5OZlK8yzdwsxgYhFIwprYrpnYilVKLmhYX5rYlmbFJg6BJKyJ65LJrtCxY8cqJawtW7Z8bbJbnLWbJATaTFiT1A91qsuxUSqLBuV7gkvCEnDFnhZPCL81Sn4Zt90IJGG1u//X0/pKNSwq4B4WRl6JwGAEkrAGY5QxViIwkoa1Mukalx/r+8Ea3/RIBHogkITVA5j07olAlRrWfko5iIz9ygKagUASVjP6cSNbUaWGdeFGVjzLqj8CSVj178ONbkGVGtb3N7ryWV69EUjCqnf/bUbtK9OweGKYhLUZPVjjMocirBq3L6tePQKVERZVuwTJKxEYGoEkrKGhyoiLCPhkb9Fa2vhx6Rwyg1YhkITVqu6upLGVEdaxY8curaRGk5tJMb92UMU9V7ziFU/C1I7RmfInZTQECkBHS5Wxm4vA4JZdPjjK0DH+Z+iYkx9xO1X8ZeQ05Nnsz733hBNO+Ar2y7Zt2zaL+eNLL730kunp6dmtW7dK1J/C/lTs1yMsryERSMIaEqiMtoRAlU8JL17KtX4WNaVbU+0nIx9DLtmyZct/YZ4OWf055u9cfvnl18W+5/Dhwzg7U5DTNFpl58iRI1fA4xbI47F/FUJ7EfZdSF4DEEjCGgBQBq9BYKRNdyZsZ7ksf7eQnPcidbp+lso+kva8D+3JBwYfxP1E5DeQHUePLvxDoaKN+MU7lJoK5KSxJJIXeUlgD5uZmfk6AfdC8uqDQBJWH3AyqCsCIxFW1xyOe04aYW2jaj+H3A55JEu2f8B8/fbt2/8D+Q72b0Ewz8e8HdrTdsKxlrsKciPfq0Jab0ELew85XhvZgKt+RSRh1a/PNrvGlW2605DN+NdeWyAfSemOLOEeDkm8AG3pXdTFl7D3QkKaalDPQwN6LHFOOXTo0M2RnyaO/zAjtCaIpUO4XqWF8v3fjJ25ubkOWtrtydCl5V9jnoDktQyBJKxlYKR1KASq3HQf53uEV6Y1v4Y8EHkaxPROiOGraDL7IJ9vQkxnQQ4vhCQeQfgdEElsqyREXAlkCrLSJKjTkaAW/Tv6u7zTHYElfswDbW1p2azGRXbbd+3a9feYH0ZS2wKE4krCKpBIc1gEFjZqho3dO55LS5+e9Y4xOGQLG9bXJdo9mOCPg4ROx/4p5OKdO3dehPlxCOpl+P8VZHVXiOF6EILLvtCSJB7ClkiJ+J0dO3aEpmMYhNYxXD8JiryMEuHaySvcZX4gzEhuXpIi9Qz3/v2+F975dRxfQCN8MGZeIJCEBQjru1qbqirC8hzSIMIyjvIToH0z5DQm9TMw/w1xk/oAT+DOxf62AwcO/D+0I48U3BKy+YmDBw/6VA5emYqlG/E6koEaDfHjKgiJSB1IIciJdBEGuUV8CaWIpx8EGWRHPSLfiFziR0K0XuZnHS2P+kddFrPdBVm+hDq+E7fnuDDaeyVhtbfv19vyqpaEPutfnpdj8ecglDtRsUcjHg/4GBP5R9gvYlJ/hrDTmbyPPvHEE++M26XSFic8/kEixAvigbjCTdxYaumvSDgSApM/NKnCT5NlYhBQQVxqPMaVoExnOaaTVAzTNMy0ZcS6KpZlPpKVBGlZujUNB4e74v4CcgOktZeDpLWNz4avCwGXcutK2CXRUyCCNyD+X0IJ7JuQwZlM0mcS9zTMX4d0roR9ixNagaim0KZiGSdROZkV4oRGJPGQh87YdzKNDtJpxP6T4bOzs6HFUEZspBtIPTrL0+sneWhahum0G8+yJS3dZQQiCqK0nhIg7Y16FWVZP/O3LOzXxP5ZxH05jPZdSVjt6/NSLWbiHzEDJ5rmIHHiLZdl8T0Z/niI4H6Ip73jiRj20I6Mp11TMQ9NtR1NxUkucRgmiRim23S6nfzGUwzTLAhIu/FMaz5qNrpp31L5hunX6XSCVEyj6Gca7ZBIEIx2y9QcFhvjLq+jpKSf+SuFXVOxPpS3FXFf7tX4bUVadSVhtaq7yzeWiT/HsmneiVZM0BK5uj9VIvlCUiZwEIpEIZEsJ52FGL1/bYNEIJGZnvZFZInPMPMeJJILm/xRB9OYn5lYD81xCGX8H/L9APKTSGuuJKzWdPXQDd0GIXmi+2Qm7e8z6Z7AJHwhqV2qfRm/d6AJBNEQD+/NvSQotSPq5YnxWN5JOkzoWCIOQzamtxWSsMRjGvOViMynnxgHjDouMc1DkfzALJatusck9oEn7D9N/tdBWnElYbWim6ORDnAtLr2uhTZxTxye5na/6A1MUje1L8Lczz7Ot5iEH2HSvpaJ9xQm5cMx3Qy/PuYuJ7CTfPkkJa9NuWhHEBV1DYLSdC/I+klcw1SKNi0t62yTaU3ncQbwiI37XqZlWabxJU2wivia5qv/mOVa1O0z9Ndvj7mcich+IwhrIhrawkrM0OZrM6HvwWB+PNrQ63D7lGkf5nloE29iYj6fwf5o5H5MvJsx8a4CGUlooR0QTtSFC/8ghEJ70L1BE3KhAj1+aUeE0Maosw40QE+Max0otL1jfAnGyLrNU/LxiIPt7CJz+O1HLibtxZqkO4ppFkFY1iccY/6xnpR7Bcj5/RTlS9cYzb2SsOrdt5KSj/I9pX1HCOQvIabXMHn+kwkjMX2dyfdWiOipTKxT8LsRzd3uIMeckXyIG5vMxIsnaLoLojJcf9JFHN2UEXs1TJAwyWfTL+tMG4MorF8hZPkjNwAAEABJREFU1Ju5PB91x7LaPILfXuKcT/rPQ+zvod2vx+8lpH8a+T2Khv0xcnfktsivID6lc8/ILyvsxq1duTLpdkN6v05+aqSzG4UP9QztkDrPUPazaYOb8T7QoHrNu5KwJrtPXcbZRz/DYDyZqt6fgfl4BuXLsH8A+5fwn2UJ9w2WL2cxYZ6O/Q+YgP+bgeznT9zTmWIyxWR1EhE/JjZ5kEUn/LWQNk5wF3EhPr3jaIDpFkkuSIr8O7t3O18jymb+zIFBtIF6+47j92nHF5D3I6+l3i+gcr6T5zEAzzG55/OL+Ekyks5JkPC1SHsTiPkO2H+fsIeS9m8wn4O8EvHApl9lUDv1v1T7SZxD+C+/POrhsYxPUuaTCPC9w0+LNfaxX5ZDnUPDxPxD+s56x81s7IVvcAFOhg0uMotbhcAe3L+E3JkN34cxAf8RMnkdg+6T2C9AnAgXMBA/gv0MzKcysR4IQd0G+/WYIDsgkGk0KLLoBBnhHybxg4QkG6XDH/HDjzxCo4LYYqlHUEx8B79xIL64czORDYo05me4Hvv27Ytw7ctlDHbJ4dvk6ys3b8F8LvJXyB8it6etEpBntbZCPFfDT03odzB9ivanmE9HXoF4Ov4TmJ6Ml3SqOrFPlmsuP9DnFx0sa01glR72h32EhhjZ2p/03Sn0ld/pCr8m/bSJsG4AEajm+3mQlzGBX0xn26kPp0PdUL4WZrxnhlnFJbbeyW9AWS7XHmx52F+FqB2dC9HspaDLkC8h/8aG74uYgI+BTH6PQfer2K+BxJ4SZmg3xIvL/ZWw8MNEVZPC1gnyId+Iaxo9DXcg0/4I120ciYm6xJ2ZugXJ6cdgD7vpDTcPpUijaRzD9R9GinzYK4u8TUMe8+TlSfazqdub8Hsmfo8k7j2wSzy+wKym6FPLX8XvPoj7NH725TXY1XwkBb9NpZaD18Rcvgzou42VVsi+K8SM7VcwjD07zUKI49sCvmdptMbIdGNa0qchTILHMwnOgQiexZ3okUwOlwgPZXI+EfcL6eQzSX4epgTyZcL/BffDkFsiOxHVa4lDbUh130/h+lTm3uT9ULQhT2y/jLzezsQ/m/gX4a9m4GQ8h4l9Fn4vwXwiA+lU5DbIdZHS6yrqHARA28KkTaEpSQy0OYiMcim+E4PacB2GUX5oTtr1L+KZp2HgEOFFfCeHduMZx3S6+wl4LGly4BQb3OYNVu8knz3Yr0L6m1L/+2E+Bj+/oPAO7C7BxA9rbS/bsFmV93tdaqKbVf5Yym0DYfnJkMcxMQJA1WcmR2ggTjjdhmkngieHr0+4y4kXMWFdhvjNJt95O8okvQz5DvJfyIeQNzPBXow29ATiPpC83KBVM7gKE3UL+cVl/sQLIlluj8CSP9Qh8oUgY4lm/tpdIkowikVAEEFe2iUOCcq0inE0DdMs3OAQe1j666dJ3nOLWC2Rmf69xHIU8IjXXjSNC1Z+z10tpMpPLpv1JInf1tq0+jAWfFgwvvI3Iec2EJZLim0ShhNVjDXpzCAtiEavmPT66WZSxuR2wkbg4o/hi9Ylw7imkSD0tBwnJRNS5woxvbLCs6TD8iSjgmjMTjv7YUFgtlU/61OQDgSrVywPJR/jK3pSv2O06VLMr9COD5Hutfg/D3kc8nDK+0fyOUZ4aHT49b3M17iWY8SCvMjbG4FeTZbNXqZesWngtoGw3CO60I4rSIVJqDOkICUmYkxg3dqdZBFhwI9xmcBBcEzCiO2klCiY+OEe54+EYJ2tg3bJS/vs7GyQsOQkoUpg1gO72uJ3MT9GuldR1ydS7wdTVz8L7BcQdtEmP+fyS4TdhjRqm3+G6QflXox5FuQT/0xhGIysk8tTsaeMjnbylUzVrsiu0ddmHy9w879RALeBsDp79uxxDykmMJMzNCsnTzHhnOT2qhPJCcWEjDia+itOPEX7clmen+mZ7EFeEoX25XHHYbfutmOxrsckY8mSsr6H+FTspRDTX0Ngd6Vtv4DdfbhrYP4W4X4/yqeOL6Puvpf2DfwOIv2uKQnRCLZds5+IgWRF2YGpdutKed5I+iVtQtimfr+K8freJoC4vA2tIKy9e/e+kgkzvzhRvLvH5CkmnJNcUJz8TqhiQhamYZJCN2HieXAzNrTN37hFOgaMzu5S3te9n8upr/sk76Ytz6B+D0ZzugVk6VLg6rg9d/QQivLR/r8R14/eSUimVQga/aKsSGTbw9LnxxuDuBhXPKhf7H1BZIM+3tcn19oE+YBmsyo7D8b++7DNKn8s5baCsEDuM0zWs+nA2ETWdCI5iZxMhMd+jMRVTMbC37BCnHDdBIKIKBJVkd6JCWGEf0U/PySfDyHPRh6E3BSRmH4e846077GYr0Bz+gzmj5FxXVPiZuZioTlIxEURc+oXWJOmDXtY9g1N3fiLvnH5/vmNL3m8JbaFsETx6XRinDnSUZCJE2m5u5iMhb9hhZhmtZin4QXBmd6JKSnqL3FpFmKYcZXCzzx0a+LncYivku7VxPWxtIcgfwp/H/+7p/R/sb8ccTBuxj6Qp+8pvhNL7LD0+SlwMMpyO25fHcJo9OXZvlINdEz0k+XjkfESZeH372D9mHA07KdNhPVWOvTrdGR0oYMAUgh7mR/zcympWWhX2hk0oc2pUSwvhzrEkghCnMf/APJJ4r6EOjwQ03f9PLXt0YpTyecf8PelVv+hAtZGXZ7gb1SDVjeGcXHDBb/x/hY3O8aUBXn2645YGrnkbhNhqV39rUQlsUAGse9Ex5a6JCC1KsjG/ONb4fqZf7HElLQo9zAD+MvEVVX/Iwq9If5XQPzPKA9lsPn6yDn4N3Kg0a7VV9PbOUP/+yXV1e2u1M0NL26Ajjky/jjj8NaYjX2g0SrCoiPfSIeeB2nE6WvcpS+JSXHgQEgdX5nRTsbzEOO/Yz4NuS3lXpUB7Al5XwU6Az//WaZHDLC28mo6YV2Tm9TYnxJywysGj28H+P8Vx7l/WZS1aWbbCMs3+p8usdjRDKjSwEtOquTmByHNQVLvYgP8VDK+EsT4a4hv/vvOW6MHEu0d9Wo0YTEmbsVNalRMRo7vWCbRK9HQ74XZ+AcZNSAsuqHay38VdYFZSjaaZUSiYrC4FPz89u3brwNB+SK13yRq3KG9Mjh1SdtowmJM/EYVN8QuuK3w4ib5d3g8ANnsU/VUYfxXGwnL80d/752Jzq4EYYmPpeAFhw4d8kxUJXk2PBP7wKehTW0mW0rTY9ewIERfmXoiIIonRvOvNhKWvfpqyOoiiUZHGWFkxub9tm3bbl4mn5aldYLFvwtraLuvyL7m9VkWjrN5fu3CT+20QrMqgGwrYR1ir+nFLucEwoFVkBf+cRJe/1GEfaurE9+zUhh5DUDAs1zdzpANSFaPYMbTb1LT6Sr2sMxDIU+yXLhwfw7xHU+Jf8GzJb9tJSyPIPwz5HSIfad4LMzeU3S5Jv5hR+UOs98Pd9IIZonp4PEjc+HOn74IiJUPQPpGqnHgHSSYYmyUaQfjKpI7LiEpD+u6/3oXPBtL+LSt59VawgKRHzIIXsu+E9aFU9uSF0u7+LdR4TnCD9qaWsOtRkjS5qiS1Tg/UbzZ2N6aTfd1aeqrK87WReSzuAKYhcB8qNPEg8Srm97V3WbCEpBncye8XKJyL0rygsT096mfd7Ow9/tZHEjxfhz2X+sXN8OWEJCsJK0ljwZZfhZNyP8VGC/YV9Eu8ot9UsboX0JgX64iz0nIYz11aDthfZk74UclKpeBDIhYHgokT/3i+1ja+wmaVQQvDipfrfGrpeGXPz0RaPKGu/+dJ252w2wp9ERoMcDvmDm2yOuDLDFfuOjdWqPthGXHP2vXrl2xDGRABEmhKenvPleY/X4YSKFdGQdtbSdpr689pS8CjX2PkPFwF8cRZpBWXxSGCJydjeNq+yAt/0eie39DpGpulCSsTue9+/fv/47ald3sklBhr0DnQIGkYmAyoGIJgMblu1wD07U8QlPPYPk5bp8QxpiQtKroZ7YsPL7gvzqrIrta55GE1em4l/IKCcsBVpjsFcSXQwf1ruRmHAlO0kLD8j/t6DVW2cTMfbhQtnjfoawin7L1qDq9//Qh/lWcY6mizN/LlsUrK8qr9tkkYS104cshHv9HXmhJkpbC/tZCaJ9f4xlM+lga4s6jDQKyTMAkXJB5mBB7rHPC0ayfe9O2eLFeUxnUvAITCW41TrgldrWr1i8FCxyTsBaQ+N6OHTvOdO9Bp+TDYInHybr7iWlQ2YPoHKCHDx/2vw9v5qdx+1V3U8LEyILVWsFZq1pt0ybhDOPgLhIQ2wKxF2pDB4lxTePYcXtB0c/xB26vI/1/I3ktIpCEtQDEPE8FX+zAcWnnYJG0GDALoX1+jYvKHnfVxWhTDLrUshbBAIvQPNUg9AJnl9qNe0oIWd0KQj5JsrGdauc+edY+SIpx5pgznQ+B8BOjJ5F2vsNPXgsIJGEt4ODvBxgs32XQhbYkeTnZDOgnDKwILgaqg418/Chf+Lf9ByxiA3o5DmDmZFzuVXs7ZHNv2jWtBilRqTHhN7BdEjnpVsTjIZBuv0L7LS0pxxFIwjqOhYcZ36jTAScBOdl09xM1MgedpukWB5v/raZfstaEiY2NLUw0EZ2NJCxvcmqQEpWatw0dJOJSxPUGqZs0fu/e/wOJNa/lCCRhLUODO91LuUPOOeD0xq7RV9TIvJtqFhEZgNfFvgtp4jXS3pPY+LoT2MbbAy6f8WsaYd0CIr6aNzk7XOLRXCQfrT1FXLwxGhdcCm3Uf8/V2tdveoJFQPMJi0aOcH2dO+R/qi2ZBrtGX2GgRviJJ564dNCUQeh5nJtFQP4s4VLguXPnTp9+NQYZNKv7QcRxTEPiURgDQ2+8g0dBVGLiDcHloPaUVQgkYa0E5Bja0evUloq75MrgtS4GangeOHD867QuDcmn6eexot2Dfpy8YBHRtEvws7OzjSIsyOneNtB2KmpMuguNS3svMT54xIMJ8vGBxEeImx+CBIRuVxLWKlQYNK/Ba35YwiKug0wjhLttbNqj3ueJ90CkEy/uSlZg0jl8+LDHRfzv04uhtTduAUFdw1YwduJdVNupexgxboEN5DVPXi8dJl1b4yRhre15v0T6QbUsyWdt8FofB52+kpx3VQcufr4IPaN/yhoEPIe1xrO8x6bkcP8ypRZkZR6Qlf8HwP9+ozOlCwJJWF1AgXRe7YY7ZpfQtV6QU+xXMODCNAZk95OY10HyWouAT2TX+tbPx/lzzzLVlrBM780O03//dggzrx4ICHiPoFZ7n8ne1FBfFHBPRsKSrETMJ4z6LZLdyfqlrEGgEYTFXqUvOl91TetG8HDc+JDHMUQy/5kuRl69EEjC6o7MpQygDzMgu4cu84XYYg/LOyV7EBHiIPRRPu78oF8gsuanEYTFGHmA/d5P1rS8i4c3N7YRPk1Qqz/OR/sHXssIa2DctkV4K4No6DYbV9m1a1dsMru5jGS6TMMAABAASURBVDsJqzuCTSCsrdyQ7ty9eaP5uv1AivwiAyAMupKweiP0dghn4AFH9x7UqNizipwWT7r7JEzN6+fxLLVkIH0TryYQ1t3RjK5QtnMgPZ+cerLdp9Nls2t8+iSs3l18MUvCj/cOXgiRrIgXWpWDT9/CNAx3nscChFVX7Z8Ssu90mjerVe0a2cmy0qMQbyBhUz+5Q9Oqu5Kw+mDJ3kS8W1gQUKFFmYQBqxHiRrsWNDKNOIdV2PFwYxZjoq4Nq4wTskthAzXXLmkmyetKR44c+W3GR5xQt429xEobzzGkqXv52DEdfnn2ChCGuZKw+qCEyv827qJHJR830XFHbImLARunk8Ojzw+DM1+EXoUPeB5b5VU3570goG3Fjapf5dW+JaXCNG4xdvTD/UXkbCSvIRBIwuoP0sUs62IwuYnOII0XeCUuSau4Y/bLgkH9K4RvR/I6jkCtX83hJvYgSeh4c3rb6P84m1eQlA9ljG16wxhHp+P2/UGMvAYhkIQ1ACFI6l+NgqYUSz2JiwEbe1ZoCgb1FQamGN+8b6T2BdaZsK7NTezGjIt4sDJM1xnXeJo+lPFGt/hkcJab378YNk5pUt5Opia1p/K2QEpvN1Pvhpq43STVOtSAhbC8w+bxhkBs6ae2m+6QzoMgnBlIK25gSy3qYfFGp3ZlsGk00ao6i1+uOBP3j5G8hkQgCWswUOcyQC9wkBl1cd9Bq8cWwuz3Q1qJ7Vb94rQwrK4a1jQ3oFMcA/brMP0mWUFyS2PFcaSfe6Lk85xh8sg4xxFIwjqORU8bg/TdLgUZYPFtJwedkVHnNfoKadXIcuN9JUq11LDo/1vTnz9jv2Nf2aI+LrVyReIyrWTHePoKWvtn+yTLoC4IJGF1AWW5l3YG51uRICtV/EK11254P3GQEt8DhtfrF69lYbUkLAjmAfaT2pHE416m7n4iORkO0cUS0vGwmO7V+NdV06Tqm3MlYQ2BOwP1I5BOHOzDHgPPgahqPyi58RbjtFbLEgMn7CIOGnWcqFeiHXdDPJnuMl/N2bb0FdtdaOSmVdNiDPlifb6K0xe57oFJWN1xWe17OQPvow44zAgrzHD0+YHoYnBzV81//XUcp9qdw4J0/CepO+x37HHTOt6c3rbl2phpjYm2/l7MHyJ5jYhAEtaQgKHKv8sB5wDEHiQ0TFLjelclbn6BFBAWr8lcEi5WrpvBEvChRd9jj/N43eKt9mOvKsaKNy4/O+R4QMP659Xx0j0cAklYw+HkHfU9alh+TkYCUhx8g5IX8SC7nyHuVZC8Op06EFYxN65Eh92dvr6RpGN/4o5loeNBez9RG6PvI4pbCKT/No73IHmtA4GiU9aRtHVJzmPgXeAgVfwvOQy+oUAwnmlYFjbhPFb8d5ihGt470qQR1k6q+ovIvXiQ8njMM+ivT2J6Rup/WML55Y546IJfHFGwTyExnX0FbSreNyQPb3qeyXs5CfJkOyCs50rCGgG1nTt3fgTSigHof8mBgIZKzeCPwYqZ/xF6AbHNICyJ9mosy25LFR4B2bwA7ef9uL+Dez/2r9Cfb0ELeirkcn/6+ZaQ10nYg6iwE63TcVmopqVb0grPPj/k0zGuxIU5j5n/wqsPXoOCqiOsQSU1IJz9iHfZDAZevPjswNXdT5gIQXAOXAZrEzSsfs0dNmychLUDUrkuFbkvN5gn0Vev40ZxDsQ0C0l9lyX9+wmTrB7BXtRtcf807insQUYFQRG3A3kFWZFf2IkXZuE2jn6DxL43Lvn5ovPFg+JneG8EkrB6Y7MmBIJ6P3fhOQbemrBeHpBUkBuTxqXEDYnnP1nFaPVVxZLoRBC8MXIqZPR34Hvmjh07zodwDtA/5+L/xtnZ2b9FC/o9COMGENN27B1vIITFHpQkQrrwo187xI+jCvob13gQXsQ1XH/yCrf5MB6MMlAkQ/Mj/Y2p37tJ8L+QvNaBQBLWaKBdyiA9m4EXWpPmoOQOcOM5MUi7jQFb9/8IPWV7nMCD2l6Ei4ETvHCTdpRjDX7pwn+Zdirl/iM4vhv5NrIP+Tx5vgoy+hvKuNPBgwevyQ1iCjveCxfuBcvir+SxaI1lunH1o2/CW7fkEg5+ID9+eUowNxfxw8GPaTAGXtR5KY75kv/twMIT7tdfCkjL0AgkYQ0N1VLEjzvwHIgMviXPXhaWJXHXNo1xmEC30KyrQLhzx44dizaJwaB2MDkjihO8iA85dPtE8gxLrWsT+T5g9mTMM0nrQ46DENMXkFeB92Pw/13kGoh7UhiTfdnv1N3N9hDa7pc+fpZa+9mi38HMawQEkrBGAGsx6gc0nXxMIK19xWWGEdAqOixdtNb5AOk0hBtEAbms0DhsWDcpiAqii/iQkEvjKxL3ZDD8E9ynE/ZFnroeYo/w60zuN6ExPZHwO4GvR0Gw1veiPbElAG5L+2H6MRa2Y76bcVHqH7HWF5n11TwJa3TcPs0kO+oAdH9jUHIGZOyReGdlIvrEqM4alku52H+CXOJA5KD2Q0oRT7wgpti0BoszwMUnrs+D0E4j7IY8dT2hwFOtxHyJp1Frsf22x7bT5tj/gqg6jgXMadroP099eK0buYGVT8IaHewfM8m+wh0yJt+g5AzIuLM6YI3LnshPYSoYtbscL7utteTiRNQ+SCCkJS2DjfFYGokHGlQkVVtj8gae+hkmvtoHSWQwwT/WX6zEoMCLG14HjTI0TttN+19AE+6HTOI1UXVyAE5UhepQGSbUh7xDOvAG1de7qoNW08FpfOw+3dI6abKLCl0TORlxqfIXTKZnY38Lbf2PPXv2fJM2vAN3HAHQHCRF2zXJIz5cJ4mroZFXJNeuJqJb03DxjcCa/xQkZTNsG/tzoWWhUYbmKS6QmcvsV0Fsv2y8lN4IJGH1xqZnCIPsQ04uNK2ecYqAYsAWkxKycsPa77wXUcZpOhHM35PcV4cwbkn5pzBx/gzSfTru19COD+P+GuYs4pO38zE/gpyB/zOo95+Twb1o88337t3rntIW3J19+/bFUlf7IJGAyM/N5tCuqENoXOQfk5aJKiZL2VCW+1wRtuRZU4ttQ6uO9oiDe5q237YXTXKM0BfbCX9+4ZdmdwSSsLrj0teXgfUJJvzQn0hxgJohgzImJlrLTXWXFPvOs0g+WfME/X1Zbj2SifB3lPcq7B+gvC/hvgw5AGFcyJ38U0yO10MIz8H+lxDuH1CH38J9HSS+RIAZRzYKk/AgDuJrDVFL0EJ6jYFC+ZGnJuXHEpk6Bha6ndBmAqaxTNIE47DrX2exbWC/1H7bUuBg27WL9SKWv0X4HiSvHgg46HsEpXcfBNzHOsfBtjqOg3OZRHAxMF3mmIbJ2OsMjhqRe0TXYtI6eO9N/EdifwoT/BXImchn8PsOcgDZTwFfRz6OvPHgwYPPp6y/If9Tsd+GSXB93HuQmDBOjEKIH9dqd3gu/him1fSain5qCdqHFdOIiaainTqGlmUeupebBTlCuEGWtNPgELBYShceA37Aa00Myyvy1N5PlsezPkVmy+2FXy/TNouhYhz6RSNkef3AxPNZ+yIgf7oikITVFZbBnmwKn10MwMGxO6EtOPidHAzMn0NLeTLul6NtvYtlw+fYhP0+k/EI4XvJ7zwm7Yexv5nB/nziP4Gy/hi5E3Iz5KeROLlN3NpftDHaQJtiyagDXGIJqZ8CRnqHGF83eAV5gVNPE+xi6SoxmMa4pjdP/bT3E+MV6SQa01gJ7ZavvZ9YXj8xH8aSWfiByIdgiaewmHl1QSAJqwsow3gx0D7gQBwUF1JaiuLgdwIxGbegpTyRifIAiOkOLBtuwibsVYl4QpHn7t2712hFxA8/4jXmsr3gEaQCFrFclCDYOws/G6o2A0ZaYxkpUeg2foFJL9NE9FWkM43xCtKxLyy/n9h/prfvLNc0muZr+Zr9xPL6CWkPonn7n5lugv0LSF59EEjC6gNOvyAG7qf7hRdhxAuScdKhRYU3A7SDhhX+huvppHUCFBPDTW39l08m3U0T2yc5SQqLmkaQi+0UD03DJAnjOvn1l0gU/fqJccxD/DXNR7MQ8+snxiP8GPnsJ+1FuL9GH51Nfh+jXG9abyfsjcgZyIuRf0KeSrzHIZ7M94zVH2M/Bbkb4kl9n8JKUL+E2z2re2L6/iNGXv0QSMLqh07/sO8wkL/LoF2xHMEviKgwvZsbx0mHFhU5MtjjRdtw8FNoFMZlUsTyEe81X7U0H8WwpgiTP8ibSR7ale2SxMVIe2FKUmKjn3EV0xY49zKJcylpLiC9r8K8D/MtpH0Ffv9Efr4C9GjsLsU8B3VH7O4d+hT357FfmfS+y7gNczc3Gs/PXRf7TenPkynzdsg9cZ+C/BHycOQvEE/q/z3pn4m8GPH77W/E/FfEzyN/DNP3IL+COfTDG+K2/krCKjEEIA83Sfvm4OQzAnE1gtwKPyZO+DGJYu9Gf+Mx4D0RH2eWmBArCFB3JGrIjyTN8jhIWhwkKIgkyMu2QgzRUuLtw/51wj8JPmchrwa/ZxEoOfwpphrM7TBvjlwL8T8V+RDDL4Zek7x8Mnt7/O9DPg/E/AvK+1tM83gp5psQv6TwUUyXZt/E/BHiP4xIUgGISbiSsEr0ApPndYOSO/mYLEE6kpHCZAvtSZOJGJPVOObFZIonY5pqXvo1WPbR7vPA4NPg8pYdO3a8gHY/CSJ5CP53od2+xuSLwrshc5dOv0C4/33ozmB3KqJ25PLL80tqML7n6U3kfNJehni5ia1oT6k5AhNDWHXEkU3cd1JvlxwY3S8mVQQwKYOIdLtfdfDgwThMiJYQ4UzIMJcTHPmHRsZkDjMiNOAHMvKLntsxPXJxHdp+K+z3AZM/oXlPQdR4zsT8DOI30D2+gTWuJJ+AoZ0/SVjl+v0IhONBzKVc0LpWkItkYyDxlvwlLf000Ri0LgnaRWhjhYfpmMyFM0zz1F+zEAO0a0qOinalsEuGptOvMLX3EcnhR8Q9h7xdLr2C9sXDBvz6JDseVNRdU1kM8V9cudRadKaRCAyHQBLWcDj1jIV28DImcZARkzrODjkxJQcTER6flZGIFP00DTee7n5iesnBuOZvXN2SnX6KGpv+2j0OYRqleOrm0tI0lms6ll4uQw/g/w3y/ABh/hfiJ5GH/9n4zphuOscxC+xuPN+YvN2QfiD5flACNB/SEZxXIrBxCCRhlcf6i2hJn3ACKwV5LJ/MPF0KrUmikNyY/LGpPEzRBTlIPqaT6CCNpeWkbvO3PMXjEJrIJRDUF0n/JpZaz6Ruj8B+d8q8EW43ok9iyXlt8rwdYafi71LsdMyzEDedf4Dp52QwOmpamhLdVsvXQTqN0aVzPL/1JM407UUgCauavn8U2cxLHp4pQmuJT6VIXhKUbsLjqR/kFhvuEEqQjmH9pCCH1SZpLkfOh5TeCxG9FPJ4DOXfl3JuhP0KyJUIuzHpfFzveaAXYXfP7RziXIKs6x9BUEaQ2PKjITPBAAANqElEQVR2kdeoV+QxaqKMnwgkYVUzBj6HBvQ6CCKOJ6C1RK6SlwTFJI8Ndwgm/NFw1FTigKRx+8ixPXv2+G+oPkg+LyTxo4jrku1alLUDAvLx/e9ieo7omWhMbyaOhFQ8IcNZ7UW528wRU2O9koS1XuRani4Jq6IBwLLssWQ1q+aBGeeotKP9LO1rSVhqVoafdNJJGufh/jxxPob5ZuS5yGNx34vA6yG79+7d62N9/5feI3E/B3HJ5mP7TTkbhNa4BYklLuRJddZ1LS0x15U6E9UIgWqrmoRVHZ7fI6snqD1BOrEkRCsKLQr/eC+OZVpHkbguu+yyWfx/AfdN0JBOxrwv8ufIM3C/jbD/RowzUZMbrXEGCUJm054qrutKDWtdsGWiJKxqx8CzmMSvh3QiVzSlMCUolmth90dCY5n4VewTRUbUZ5hru5qj7VGGSZBxEoGqEEjCqgrJxXyYxKdBUJ/T6ZIJeyyfdCu60aD0+0/ddRPIdqv7V7ajRN3XteFforxM2hAEkrCq78jDbMDfg2wvUtOStNCmYtNdjasQSOsbxBlwTWRwjpmJ7JZ2VCoH3xj6mX2sC8n2Dkg8rYOcYu9KAlM70c2yyk+VEKV210wFNc49rApAbGMWSVjj6/UvkvUd0a58wTfOXKltQVTxH2fYkPcdOaLU66INVRBWHffu6tVRDa1tEtZ4O/bf2es5Gfm+WhVLxTjiwFM2T5F/eLxFjy33KggrNay13ZM+QyCQhDUESGWioEl9Yffu3f6/uZeyIX8YDeti8vsjZFPOUVFu2auKMZOb7mV7oaXpqxh8LYVu+Gbv3bvXV2Eewh7WiRDYT5LyPUhdryo0rFwS1rX3N7neSVgb2wFN0Cz8imdZ1HJJWBbBlqZvCmG1tPs2vtnT09MzbLx7jmzowo0/Pb0w1LSTsK7LYaqe12YisDCKNrMGWXbdEKhizOSSsG69PiH1rWLwTUhTshobhEAuCTcI6CxmLQJJWGsxSZ/+CFQxZkrt5fWvXoY2GYEqBl+T8cm2rUWgijGThLUW1/QZAoEqBt8QxWSUBiFQxZjJp4QNGhAb2ZQqBt9G1jfL2nwEqhgzqWFtfj/WowaralnF4FuVZToTgYEI5FPCgRBlhG4IJGF1QyX9+iEwPTU1Ff/WrF+k5WFTU1PxtQr9pqamNFLDEoWUkRFIwhoZstYnCMYpiULuYZUEsK3Jk7Ca3PPjaVsVhJUn3cfTN43PNQmr8V08kQ3MJeFEdsvkVyoJa/L7aNJqWMWYSQ1r0nq1JvWpYvDVpKlZzYoQqGJJmHtYFXXG8WzaYUvCakc/V9bK+fn5KggrNazKeqRdGSVhtau/q2htFYSVGlYVPdHCPJKwWtjpZZqMhjXy97C6lHe0i196JQIDEUjCCojyJxFIBOqAQBJWHXppsupY9rUa96/K5jFZiGRtNgyBJKwNgzoLWkTA5WAV+2CL2aXRJgSSsNrU29W0tSzZqGFVU5P15ZKpaoxAElaNO6+mVVfDyiVhTTtvs6udhLXZPdC+8vO1nPb1eWUtTsKqDMrWZFRWO8ozWK0ZKtU3dFTCqr4GmWPbEDjStgZne6tDIAmrOiwzp+EQyCXhcDhlrC4IJGF1ASW9xopAPiUcK7zNzjwJq9n9W6p1Y0qchDUmYNuQbRJWG3p5strosYbJqlHWpjYIJGHVpquaUdGpqSk1rLKHT5sBRrZiZASSsEaGrPUJSh1rgLDUsErl0foeGAcANckzCasmHdWgauZTwgZ15kY3JQlroxGvf3kjH/ycn19QqKanY7gdrj8E2YLNQiBG0GYVnuXWEoEF9ll/1d3DWn/qTNlqBJKwquj+duVRlrDypHu7xkulrU3CqhTOVmSWhNWKbp7MRiZhTWa/THKtRt7DWtWY3MNaBUg6h0cgCWt4rDLmAgJlNSwJq8bnsBZAyN/NQSAJa3Nwr3OpZQnLPayyedQZv6x7CQSSsEqA19KkZckmnxK2dOBU0ewkrCpQbFEe09PTIx38nJpaWP1NTU11jh071pmamjrYIriyqRUjsMGEVXHtM7vNQGAkDctDoyeccEJHc7GyLgkXrWkkAqMhkIQ1Gl4Zu9M5NgoIaGSdyy9fWAXOzMxod9N9lCwybiKwhEAS1hIUaRkSgZEIyzxZBmp01LS2bt16KBz5kwisA4EkrHWA1vIkcwUBDcAhgt23UrPScfjw4c6RI0dyD0swUtaFQBLWumBrdaKRNSxJS5JTtm3blhpWq4dPucYnYZXDr42pg7AkH2VYANx0V9Cycg9rWNAy3hoEkrDWQJIeAxAY6Smhea0iNj/gp3dKgxDYqKYkYW0U0s0pZ05NqZBhmjU3N+f5qyJqLgkLJNIcGYEkrJEha32CWBKWQCGXhCXAa3vSJKy2j4DR2192STc7epGZIhFYQCAJawGHTf2tWeFJWDXrsCZVNwmrSb25MW1ZOLa+/rLyHNb6sWt9yiSs1g+BkQEoq2ElYY0MeSYoEEjCKpBIc1gEyhJWu/ewhkU543VFIAmrKyzp2QeBsk8J82sNfcDNoP4IJGH1xydDVyEwPz9f9lhCLglXYZrO4RFIwhoeq4y5gMDcgrHu3zw4um7oMmG9CCv7axIQKLOHJVnlknASerGmdUjCqmnHbWK1yxDOAeq98M1kLHklAqMikIQ1KmIZXy1pvSjk/tV6kct0gUASVsCQPyMgUEbDkuyG/NrDCDXKqK1BIAmrNV1dWUPL7GHtq6wWmVErEUjCamW3l2p0maeEHhrNPaxS8Lc7cRJWu/t/5NYfO3ZspH0o/2uOhSx+xC+XhIKRshqBod1JWENDlREXERhpSQjBRbJFc3848icRWCcCSVjrBK7FydSShm6+/9qriIy29ePCnmYisB4EkrDWg1q707gPNTQC/hNVl4OQlZ9Jzk33oZHLiN0QSMLqhkq9/Da6tiNrWPPz8x2XhJi5JNzo3mpYeUlYDevQDWjOSJvualhbtmzpqGFRt71IXonAuhFIwlo3dK1NOJKGJVEdPXo0NCy0rEtbi1o2vBIEkrAqgbFVmYz8lHDZxnsuCUsOlbYnT8Jq+wgYvf373EQfJZnLwsX4uSRcBCKN9SGQhLU+3Nqc6mBBWO5NjQhEHmsYEbCMvhKBJKyVeKRrMAIH2IvqSFbuTQ2OviJG7mGtgCMdoyLQKsIaFZyM3xWB2YKslu1NdY3YxTMJqwso6TU8AklYw2OVMRcQmEezOuLTv2V7Uwshg39zSTgYo4zRB4EkrD7gZFB3BGZmZpaWhd1jdPX16aJfHO0amJ6JwDAIJGENg1LGWYHA3Nzcfkirg6a1wn+A4zLCN+7jfRSWV/MQSMJqXp+OvUUsB2fn5+d9N3CUsi4ZJXLGTQS6IZCE1Q2V9OuLANpV7EVJWn0jLgvctm3bD5c505oIrAuBJKx1wdb6RAeGJSufKIrWkSNHguS0pyQC60WgO2GtN7dM1woEICv3o4Zqq08SWUL68vMPhkqQkRKBPggkYfUBJ4O6IzAKYZmDB023b9+eS0LBSCmFQBJWKfjamXhqamro5R3k1mH/qnPgwIEftROtbHWVCCRhVYlmLfMavdJoTP8jEY2Y8rsjxs/oicAaBJKw1kCSHoMQQMMaej/K/avDhw/77uG3B+Wb4YnAIASSsAYhlOHdEBj6nUDILdIfPXo097ACifwpg0ASVhn0Wpp2bm7uEjWnYZpPXJ8QGvV7/qRsKgK1LzwJq/ZduPEN2Lp16w/YxyqIqG8FZmZm/DyyG+6H+0bMwERgCASSsIYAKaOsRODIkSMXQVoS0cqALi41rC1btrh/Nd8lOL0SgZEQSMIaCa6MvIjApZDWQYho0dnb8JtZ7F+d3ztGhiQCwyOQhDU8VhnzOALzENElENFxnx42T7pDbGpYPWKkdyIwPAJJWMNjlTGXIQARXQhpLfPpbnXpCLGd1z00fROB0RBIwhoNr4y9iABPCc+HtBZdvQ2WjgZ+0Z+URKAsAklYZRFsaXqeEg6lYUFsIvRVf+okWdfJRCAJazL7pQ61+qqv5xQHQzWLJWJh2gji+ErOfu0piUBZBJKwyiLY3vRf9shC0fwdO3Z0iiUiJNWRtBa1q08RZw7JKxEojUASVmkIW5vBuTz960hOmrOzsx0Pie7evbsjkUleLBsNl7BaC1I2vFoExkJY1VYxc5tQBPby9C/2piQt66hWtW/fPq3xSRndON6H5JUIVIJAElYlMLYzEzSqDyKxFHQPy68yiMT27ds72tGyPDD6Jf1SEoEqEEjCqgLFlubB0u+tSLxTKHEJg1rVoUOHQsNiD+s5+qUkAlUhkIRVFZLtzOcjU1NT73evCm2q4yFRTaFAw/oW/qdrT0kEqkIgCasqJFuaD/tX92Y5+CE1LA+JolVJXEeA4/eRA0heiUBlCCRhVQZlazPaC2ndHqJ6BMT1cfav3gVx3RI08ukgIORVLQJJWNXi2dbcLueJ4YsgrpNnZ2fvBAhfQPJqHAKb36AkrM3vgybVIL951aTenMC2JGFNYKdklRKBRKA7AklY3XFJ30QgEZhABJKwNqxTsqBEIBEoi0ASVlkEM30ikAhsGAJJWBsGdRaUCCQCZRFIwiqLYKZPBNYikD5jQiAJa0zAZraJQCJQPQJJWNVjmjkmAonAmBBIwhoTsJltIpAIVI/A/wcAAP//NoLWxAAAAAZJREFUAwBOSk/QQZbNaAAAAABJRU5ErkJggg==';

let cachedGlyphImage: HTMLImageElement | null = null;

export function createMahjongTileTexture(size = DEFAULT_TILE_SIZE): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([
      // top row: white front
      250, 250, 245, 255, 250, 250, 245, 255,
      // bottom row: gold sides
      196, 143, 55, 255, 196, 143, 55, 255,
    ]);
    const placeholder = new THREE.DataTexture(data, 2, 2);
    placeholder.colorSpace = THREE.SRGBColorSpace;
    placeholder.flipY = true;
    placeholder.generateMipmaps = false;
    placeholder.minFilter = THREE.LinearFilter;
    placeholder.magFilter = THREE.LinearFilter;
    placeholder.needsUpdate = true;
    return placeholder;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Unable to create 2D context for mahjong tile texture');
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = true;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const glyphImage = getGlyphImage();
  if (glyphImage.complete && glyphImage.naturalWidth > 0) {
    drawAtlas(ctx, size, glyphImage);
  } else {
    drawAtlas(ctx, size, null);
    glyphImage.onload = () => {
      drawAtlas(ctx, size, glyphImage);
      texture.needsUpdate = true;
    };
  }

  return texture;
}

/**
 * Generates grayscale PBR maps aligned to the atlas:
 * - Front (top half): smooth ceramic (low roughness, near-zero metalness), mild AO.
 * - Sides (bottom half): moderate roughness/metalness (baseline for gold without overpowering front).
 * Adds subtle noise to avoid flat highlights.
 */
export function createMahjongMaterialMaps(size = DEFAULT_TILE_SIZE): MahjongMaterialMaps {
  if (typeof document === 'undefined') {
    const makeMap = (value: number): THREE.DataTexture => {
      const data = new Uint8Array([value, value, value, 255]);
      const tex = new THREE.DataTexture(data, 1, 1);
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.flipY = true;
      tex.needsUpdate = true;
      return tex;
    };
    return {
      roughnessMap: makeMap(64),
      metalnessMap: makeMap(16),
      aoMap: makeMap(230),
    };
  }

  const roughCanvas = document.createElement('canvas');
  const metalCanvas = document.createElement('canvas');
  const aoCanvas = document.createElement('canvas');
  roughCanvas.width = metalCanvas.width = aoCanvas.width = size;
  roughCanvas.height = metalCanvas.height = aoCanvas.height = size;
  const rand = createSeededRandom(20241201);

  const ctxOptions: CanvasRenderingContext2DSettings = { willReadFrequently: true };
  const roughCtx = roughCanvas.getContext('2d', ctxOptions);
  const metalCtx = metalCanvas.getContext('2d', ctxOptions);
  const aoCtx = aoCanvas.getContext('2d', ctxOptions);
  if (!roughCtx || !metalCtx || !aoCtx) {
    throw new Error('Unable to create PBR map contexts');
  }

  const half = size / 2;

  // Roughness: front smoother (~0.18), sides tighter gloss (~0.25) for gold.
  fillRect(roughCtx, 46, 0, 0, size, half);
  fillRect(roughCtx, 64, 0, half, size, half);

  // Metalness: front ceramic (~0.03), sides high (~0.94) for gold.
  fillRect(metalCtx, 8, 0, 0, size, half);
  fillRect(metalCtx, 240, 0, half, size, half);

  // AO: gentle vignette on front, neutral on sides.
  const aoGrad = aoCtx.createLinearGradient(0, 0, 0, size);
  aoGrad.addColorStop(0, 'rgb(205,205,205)');
  aoGrad.addColorStop(0.35, 'rgb(225,225,225)');
  aoGrad.addColorStop(0.5, 'rgb(245,245,245)');
  aoGrad.addColorStop(1, 'rgb(235,235,235)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, size, size);

  addNoise(roughCtx, size, half, 3, 0, rand);
  addNoise(roughCtx, size, half, 3, half, rand);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const metalnessMap = new THREE.CanvasTexture(metalCanvas);
  const aoMap = new THREE.CanvasTexture(aoCanvas);
  [roughnessMap, metalnessMap, aoMap].forEach((tex) => {
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = true;
    tex.needsUpdate = true;
  });

  return { roughnessMap, metalnessMap, aoMap };
}

function drawAtlas(
  ctx: CanvasRenderingContext2D,
  size: number,
  glyph: HTMLImageElement | null
): void {
  ctx.clearRect(0, 0, size, size);
  drawFrontFace(ctx, size, glyph);
  drawSideFaces(ctx, size);
}

function drawFrontFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  glyph: HTMLImageElement | null
): void {
  const half = size / 2;
  const rand = createSeededRandom(20241203);
  ctx.save();
  ctx.fillStyle = FRONT_COLOR;
  ctx.fillRect(0, 0, size, half);

  const inset = size * 0.06;
  const innerWidth = size - inset * 2;
  const innerHeight = half - inset * 2;

  const faceGradient = ctx.createLinearGradient(0, inset, 0, inset + innerHeight);
  faceGradient.addColorStop(0, '#ffffff');
  faceGradient.addColorStop(1, '#f1ece3');
  ctx.fillStyle = faceGradient;
  ctx.fillRect(inset, inset, innerWidth, innerHeight);

  ctx.strokeStyle = FRONT_BORDER_COLOR;
  ctx.lineWidth = size * 0.012;
  ctx.strokeRect(inset, inset, innerWidth, innerHeight);

  addFrontNoise(ctx, size, half, rand);
  drawCenteredGlyph(ctx, size, half, glyph);
  ctx.restore();
}

function drawCenteredGlyph(
  ctx: CanvasRenderingContext2D,
  size: number,
  half: number,
  glyph: HTMLImageElement | null
): void {
  if (!glyph || !glyph.complete || glyph.naturalWidth === 0) {
    return;
  }
  const maxWidth = size * 0.98; // slightly wider footprint
  const maxHeight = half * 0.7; // maintain vertical padding
  const heightScale = maxHeight / glyph.naturalHeight;
  const widthScale = Math.min(maxWidth / glyph.naturalWidth, heightScale * 1.4);
  const drawW = glyph.naturalWidth * widthScale;
  const drawH = glyph.naturalHeight * heightScale;
  const centerX = size / 2;
  const centerY = half / 2;

  const tinted = document.createElement('canvas');
  tinted.width = glyph.naturalWidth;
  tinted.height = glyph.naturalHeight;
  const tctx = tinted.getContext('2d');
  if (!tctx) {
    return;
  }
  tctx.clearRect(0, 0, tinted.width, tinted.height);
  tctx.drawImage(glyph, 0, 0, tinted.width, tinted.height);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = SYMBOL_COLOR;
  tctx.fillRect(0, 0, tinted.width, tinted.height);
  tctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = drawH * 0.06;
  ctx.shadowOffsetY = drawH * 0.03;
  ctx.drawImage(tinted, -drawW / 2, -drawH / 2, drawW, drawH);

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = Math.min(drawW, drawH) * 0.03;
  ctx.strokeRect(-drawW * 0.5, -drawH * 0.5, drawW, drawH);
  ctx.restore();
}

function drawSideFaces(ctx: CanvasRenderingContext2D, size: number): void {
  const half = size / 2;
  const rand = createSeededRandom(20241205);
  ctx.save();
  ctx.translate(0, half);

  // Base gold tone
  ctx.fillStyle = GOLD_BASE_COLOR;
  ctx.fillRect(0, 0, size, half);

  // Gentle vertical tint
  const softVertical = ctx.createLinearGradient(0, 0, 0, half);
  softVertical.addColorStop(0, 'rgba(255, 225, 150, 0.12)');
  softVertical.addColorStop(1, 'rgba(120, 70, 20, 0.12)');
  ctx.fillStyle = softVertical;
  ctx.fillRect(0, 0, size, half);

  // Subtle radial highlight at center to unify faces.
  const radial = ctx.createRadialGradient(
    size * 0.5,
    half * 0.5,
    0,
    size * 0.5,
    half * 0.5,
    half * 0.75
  );
  radial.addColorStop(0, 'rgba(255, 240, 200, 0.08)');
  radial.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, half);

  addSideNoise(ctx, size, half, rand);

  ctx.restore();
}

function addFrontNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  half: number,
  random: RandomSource
): void {
  const imageData = ctx.getImageData(0, 0, size, half);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const base = (random() - 0.5) * FRONT_NOISE_LEVEL;
    data[i] = clamp255(data[i] + base);
    data[i + 1] = clamp255(data[i + 1] + base);
    data[i + 2] = clamp255(data[i + 2] + base);

    if (random() < 0.01) {
      const speck = (random() - 0.5) * FRONT_NOISE_LEVEL * 1.8;
      data[i] = clamp255(data[i] + speck);
      data[i + 1] = clamp255(data[i + 1] + speck);
      data[i + 2] = clamp255(data[i + 2] + speck);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function addSideNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  half: number,
  random: RandomSource
): void {
  const imageData = ctx.getImageData(0, half, size, half);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const base = (random() - 0.5) * GOLD_NOISE_LEVEL;
    data[i] = clamp255(data[i] + base);
    data[i + 1] = clamp255(data[i + 1] + base * 0.9);
    data[i + 2] = clamp255(data[i + 2] + base * 0.6);

    if (random() < 0.008) {
      const streak = (random() - 0.5) * GOLD_NOISE_LEVEL * 1.6;
      data[i] = clamp255(data[i] + streak);
      data[i + 1] = clamp255(data[i + 1] + streak * 0.9);
      data[i + 2] = clamp255(data[i + 2] + streak * 0.6);
    }
  }
  ctx.putImageData(imageData, 0, half);
}

function getGlyphImage(): HTMLImageElement {
  if (cachedGlyphImage) {
    return cachedGlyphImage;
  }
  const img = new Image();
  img.src = GLYPH_DATA_URL;
  cachedGlyphImage = img;
  return img;
}

function fillRect(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.fillStyle = `rgb(${value},${value},${value})`;
  ctx.fillRect(x, y, w, h);
}

function addNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  regionHeight: number,
  strength: number,
  offsetY = 0,
  random: RandomSource = Math.random
): void {
  const imageData = ctx.getImageData(0, offsetY, size, regionHeight);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * strength;
    const v = data[i] + n;
    data[i] = data[i + 1] = data[i + 2] = clamp255(v);
  }
  ctx.putImageData(imageData, 0, offsetY);
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}
